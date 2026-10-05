// Public CLI journeys for document findings and tool failure recovery.
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { GUIDE } from '#tests/config/samples/docs.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, REPOSITORY, CORRECTIONS } from '#tests/config/tools/configurations/general/markdown-docs-prose.ts';

const repository: RepositoryScenario = {
    ...REPOSITORY,
    corrected: (entry) => ({
        files: Object.fromEntries(Object.keys(entry.files).map((path) => [path, CORRECTIONS[entry.check] ?? GUIDE])),
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

describe('the markdown, docs and prose configurations', () => {
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

    test(
        'installation restores missing Vale dictionaries and the check accepts the restored styles',
        async () => {
            const { root: sandbox, environment } = testRepository;
            rmSync(join(sandbox, '.gspot', 'config', 'vale', 'styles', 'config', 'dictionaries'), {
                recursive: true,
            });
            const broken = await spawnGspot(sandbox, ['check', '--only', 'prose/vale', '--json'], environment);
            expect(broken.code, 'a Vale that cannot run is an error, never a pass').toBe(2);
            expect((JSON.parse(broken.stdout) as RunReport).checks).toMatchObject([
                { check: 'prose/vale', status: 'error' },
            ]);
            // Install reacquires the missing dictionaries through the acquisition command in the diagnostic.
            const synced = await spawnGspot(sandbox, ['install'], environment);
            expect(synced.code, synced.stdout + synced.stderr).toBe(0);
            const corrected = await spawnGspot(sandbox, ['check', '--only', 'prose/vale', '--json'], environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
                { check: 'prose/vale', status: 'passed', findings: [] },
            ]);
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});
