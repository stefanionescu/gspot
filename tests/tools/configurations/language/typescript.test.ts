// Checks used by a TypeScript repository report their expected findings and accept the corrections.
import { join } from 'node:path';
import { mkdirSync, appendFileSync } from 'node:fs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { installToolProjects } from '#tests/harness/install.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import { REPOSITORY } from '#tests/config/tools/configurations/language/typescript/checks.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
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
