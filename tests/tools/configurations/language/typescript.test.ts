// Checks used by a TypeScript repository report their expected findings and accept the corrections.
import { join } from 'node:path';
import { mkdirSync, appendFileSync } from 'node:fs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { containing } from '#tests/harness/expectations.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import { installToolProjects } from '#tests/harness/install.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, REPOSITORY } from '#tests/config/tools/configurations/language/typescript/checks.ts';
import { MISSPELLED, ARCHITECTURE } from '#tests/config/tools/configurations/language/typescript/source.ts';

const repository: RepositoryScenario = {
    ...REPOSITORY,
    prepare: async (root, environment) => {
        mkdirSync(join(root, 'node_modules'));

        appendFileSync(join(root, 'gspot.toml'), `\n${ARCHITECTURE}`);
        const applied = await spawnGspot(root, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installToolProjects(root);
        const formatted = await spawnGspot(root, ['check', '--only', 'format/prettier', '--fix'], environment);
        expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    },
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

describe('the typescript configuration', () => {
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
        'every check passes on the clean repository',
        async () => {
            const { root, environment } = testRepository;
            const whole = await spawnGspot(root, ['check'], environment);
            expect(whole.code, whole.stdout).toBe(0);
        },
        NATIVE_TEST_TIMEOUT_MS,
    );

    // typos forgets its exclude list for a file named on the command line unless it is told to keep it.
    test(
        'spelling/typos keeps its exclusions for a file named on the command line',
        async () => {
            const { root, environment } = testRepository;
            const restore = applyChanges(root, {
                check: 'spelling/typos',
                files: { 'assets/mark.svg': `<svg><title>${MISSPELLED}</title></svg>\n` },
            });
            try {
                const excluded = await spawnGspot(
                    root,
                    ['check', '--only', 'spelling/typos', '--json', '--', 'assets/mark.svg'],
                    environment,
                );
                expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);
                expect((JSON.parse(excluded.stdout) as RunReport).checks).toMatchObject([
                    { check: 'spelling/typos', status: 'passed', fileCount: 1 },
                ]);
            } finally {
                restore();
            }
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});
