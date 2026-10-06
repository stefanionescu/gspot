// SQL syntax, keyword casing, and column naming retain independent native regressions.
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, SQL_CLEAN, REPOSITORY } from '#tests/config/tools/configurations/language/sql.ts';

describe('the sql configuration', () => {
    const repository: RepositoryScenario = {
        ...REPOSITORY,
        prepare: async (root, environment) => {
            const exclusion = { paths: ['db/report.sql'], reason: 'A script for psql, which the linter cannot read.' };
            const excluded = await spawnGspot(
                root,
                ['set', 'tools.sqlfluff.exclude', JSON.stringify(exclusion)],
                environment,
            );
            if (excluded.code !== 0) throw new Error(`The exclusion was not set: ${excluded.stdout}${excluded.stderr}`);
        },
        corrected: (entry) => ({
            files: Object.fromEntries(Object.keys(entry.files).map((file) => [file, SQL_CLEAN])),
        }),
    };
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(repository, spawnGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });
    for (const entry of CASES) {
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
