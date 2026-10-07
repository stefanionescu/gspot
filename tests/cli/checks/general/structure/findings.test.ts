// Test repository for the structure configuration: each repository-shape check fires on its test defect.
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { git } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { BYTES_PER_KB } from '#cli/config/platform/runtime.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { REPOSITORY, OVER_LIMIT_KB } from '#tests/config/cli/checks/general/structure/findings.ts';

const repository: RepositoryScenario = {
    ...REPOSITORY,
    prepare: async (root) => {
        const policy = join(root, 'gspot.toml');
        await Bun.write(policy, `${await Bun.file(policy).text()}require_reasons = true\n`);
    },
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

describe('the structure configuration', () => {
    test('structure/large-files reports an oversized file and accepts its removal', async () => {
        const entry: FindingCase = {
            check: 'structure/large-files',
            files: { 'notes/big.txt': 'x'.repeat(OVER_LIMIT_KB * BYTES_PER_KB) },
            expected: { file: 'notes/big.txt', rule: 'size', line: 1 },
        };
        const { failed: outcome, passed: correction } = await runFindingCase(testRepository, entry, repository);
        expect(outcome.code, `${entry.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
        expect(outcome.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
        expect(outcome.report.checks[0]?.findings).toContainEqual(
            containing({ check: entry.check, ...entry.expected }),
        );
        expect(correction.code, `${entry.check} corrected: ${correction.stdout}${correction.stderr}`).toBe(0);
        expect(correction.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
    });

    test('structure/tracked-dependencies reports a dependency folder that git tracks', async () => {
        const { root, environment } = testRepository;
        const command = ['check', '--only', 'structure/tracked-dependencies', '--json'];
        const clean = await runGspot(root, command, environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        mkdirSync(join(root, 'web', 'node_modules', 'left-pad'), { recursive: true });
        await Bun.write(join(root, 'web', 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n');
        expect(git(root, ['add', '-f', 'web/node_modules/left-pad/index.js']).code).toBe(0);
        const tracked = await runGspot(root, command, environment);
        expect(tracked.code).toBe(1);
        expect((JSON.parse(tracked.stdout) as RunReport).checks).toMatchObject([
            {
                check: 'structure/tracked-dependencies',
                status: 'failed',
                findings: [{ file: 'web/node_modules', rule: 'tracked-folder', line: 1 }],
            },
        ]);
        expect(git(root, ['rm', '-r', '--cached', '--quiet', 'web/node_modules']).code).toBe(0);
        const corrected = await runGspot(root, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'structure/tracked-dependencies', status: 'passed', findings: [] },
        ]);
    });
});
