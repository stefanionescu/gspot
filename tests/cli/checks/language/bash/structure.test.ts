// The built-in Bash checks on test scripts, run in-process: each fires on its defect and accepts the correction.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { containing } from '#tests/harness/expectations.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { commitAll, markExecutable } from '#tests/harness/git.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
import { BASH_CASES_MAIN as MAIN } from '#tests/config/samples/bash.ts';

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
    const request = buildCheckInput(session, 'bash/syntax');
    const files = names.map((path) => session.repository.files.find((file) => file.path === path)!);
    const first = await getScriptIndex({ ...request, files: files.slice(0, 2) });
    const second = await getScriptIndex({ ...request, files: files.slice(2) });
    expect(first.files.map((file) => file.path)).toStrictEqual(names.slice(0, 2));
    expect(second.files.map((file) => file.path)).toStrictEqual(names.slice(2));
    expect([...second.owners.keys()]).toStrictEqual(['name2', 'name3']);
});
