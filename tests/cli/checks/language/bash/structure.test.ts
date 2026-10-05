// The built-in Bash checks on test scripts, run in-process: each fires on its defect and accepts the correction.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { containing } from '#tests/harness/expectations.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { commitAll, markExecutable } from '#tests/harness/git.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import type { CaseChanges } from '#tests/types/harness/preservation.ts';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import { CLEAN, REPOSITORY } from '#tests/config/cli/checks/language/bash/structure.ts';
import { BASH_CASES, TOOL_CHECKS, BASH_CASES_MAIN as MAIN } from '#tests/config/samples/bash.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';

// What a check accepts beside the clean scripts: a guarded settings file, a boundary header, the environment owner.
const CORRECTIONS: Record<string, (repository: Pick<CaseChanges, 'files'>) => Record<string, string>> = {
    'bash/guards': () => ({
        'scripts/settings.sh':
            '#!/usr/bin/env bash\n[[ -n ${SETTINGS_READY:-} ]] && return 0\nreadonly SETTINGS_READY=1\nreadonly PORT=8080\n',
    }),
    'bash/boundaries': () => ({
        'deploy/step.sh': CLEAN.replace(
            '#!/usr/bin/env bash',
            '#!/usr/bin/env bash\n# Boundary: Owns deployment steps and their explicit input values.',
        ),
    }),
    'bash/env-owner': (repository) => ({ 'scripts/environment.sh': repository.files['scripts/environment.sh']! }),
};

describe('the built-in bash checks', () => {
    const repository: RepositoryScenario = {
        ...REPOSITORY,
        prepare: (root) => {
            markExecutable(root, 'scripts/build.sh');
        },
        corrected: (entry) => ({
            files: {
                ...Object.fromEntries(Object.keys(entry.files).map((path) => [path, CLEAN])),
                ...CORRECTIONS[entry.check]?.(entry),
            },
        }),
    };
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(repository, runGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });
    for (const entry of BASH_CASES.filter((entry) => !TOOL_CHECKS.includes(entry.check))) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                const { failed: outcome, passed: correction } = await runFindingCase(testRepository, entry, repository);
                expect(outcome.code, `${entry.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
                expect(outcome.report.checks[0]?.findings).toContainEqual(
                    containing({ check: entry.check, ...entry.expected }),
                );
                expect(correction.code, `${entry.check} corrected: ${correction.stdout}${correction.stderr}`).toBe(0);
                expect(correction.report.checks).toMatchObject([
                    { check: entry.check, status: 'passed', findings: [] },
                ]);
            },
            suiteTimeout(),
        );
    }
});

test.each([
    ['4.3', false],
    ['4.4', true],
] as const)('Bash %s requires only the strict-mode options its version supports', async (version, isInherited) => {
    const base = `#!/usr/bin/env bash\n#\n# Prints a greeting.\n# Runtime: Bash ${version}+, macOS and Linux.\nset -euo pipefail\n`;
    const inherited = 'shopt -s inherit_errexit\n';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[bash]\nplatforms = "macOS and Linux"\n', level: 'all' }),
        'greet.sh': base + (isInherited ? inherited : '') + MAIN,
    });
    const path = join(sandbox.path, 'greet.sh');
    commitAll(sandbox.path);
    markExecutable(sandbox.path, 'greet.sh');
    const command = ['check', '--only', 'bash/contract', '--json'];
    const clean = await runGspot(sandbox.path, command);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    writeFileSync(path, base + (isInherited ? '' : inherited) + MAIN);
    const broken = await runGspot(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect((JSON.parse(broken.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/contract', status: 'failed' },
    ]);
    expect((JSON.parse(broken.stdout) as RunReport).checks[0]!.findings).toContainEqual(
        containing({ file: 'greet.sh', rule: isInherited ? 'strict-mode' : 'bash-version' }),
    );
    writeFileSync(path, base + (isInherited ? inherited : '') + MAIN);
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/contract', status: 'passed', findings: [] },
    ]);
});

// Windows file names cannot hold a newline.
test.skipIf(!isPosix)('shell reads distinguish filename lists containing newlines', async () => {
    await using sandbox = await testdir();
    const names = ['a.sh', 'b.sh\nc.sh', 'a.sh\nb.sh', 'c.sh'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        ...Object.fromEntries(
            names.map((name, index) => [name, `function name${String(index)}() { echo ${String(index)}; }\n`]),
        ),
    });
    const session = await openSession(sandbox.path);
    const request = buildEngineInput(session, 'bash/syntax');
    const files = names.map((path) => session.repository.files.find((file) => file.path === path)!);
    const first = await getScriptIndex({ ...request, files: files.slice(0, 2) });
    const second = await getScriptIndex({ ...request, files: files.slice(2) });
    expect(first.files.map((file) => file.path)).toStrictEqual(names.slice(0, 2));
    expect(second.files.map((file) => file.path)).toStrictEqual(names.slice(2));
    expect([...second.owners.keys()]).toStrictEqual(['name2', 'name3']);
});
