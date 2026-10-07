// Environment linting, template declarations and tracked-file policy share the secrets owner.
import { join } from 'node:path';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, REPOSITORY } from '#tests/config/tools/configurations/general/secrets/environment.ts';

describe('environment checks in the secrets configuration', () => {
    const resources = new AsyncDisposableStack();
    let repository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            repository = resources.use(await createTestRepository(REPOSITORY, spawnGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });
    for (const entry of CASES)
        test(
            `${entry.check} reports its environment defect and accepts the correction`,
            async () => {
                const { failed, passed } = await runFindingCase(repository, entry, REPOSITORY);
                expect(failed.code, failed.stdout + failed.stderr).toBe(1);
                expect(failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
                expect(failed.report.checks[0]!.findings).toContainEqual(containing(entry.expected));
                expect(passed.code, passed.stdout + passed.stderr).toBe(0);
                expect(passed.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
            },
            suiteTimeout(),
        );
    test(
        'the pinned dotenv fixer corrects the tracked environment template',
        async () => {
            const { root, environment } = repository;
            await Bun.write(join(root, '.env.example'), 'lowercase=value\n');
            const fixed = await spawnGspot(root, ['check', '--only', 'secrets/dotenv-linter', '--fix'], environment);
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            expect(await Bun.file(join(root, '.env.example')).text()).toBe('LOWERCASE=value\n');
            const checked = await spawnGspot(root, ['check', '--only', 'secrets/dotenv-linter', '--json'], environment);
            expect(checked.code, checked.stdout + checked.stderr).toBe(0);
            expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
                { check: 'secrets/dotenv-linter', status: 'passed', findings: [] },
            ]);
        },
        suiteTimeout(),
    );
});
