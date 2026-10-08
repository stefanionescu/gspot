// Checks used by a TypeScript repository report their expected findings and pass after the fixes.
import { join } from 'node:path';
import { appendFile } from 'node:fs/promises';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { installToolProjects } from '#tests/harness/install.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { createTestRepository, prepareTestRepository } from '#tests/harness/repository.ts';
import { REPOSITORY } from '#tests/config/tools/configurations/language/typescript/checks.ts';
import { ARCHITECTURE } from '#tests/config/tools/configurations/language/typescript/source.ts';
import type { InstalledScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';

const repository: InstalledScenario = {
    ...REPOSITORY,
    prepare: async (root, environment) => {
        await appendFile(join(root, 'gspot.toml'), `\n${ARCHITECTURE}`);
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
    testRepository = resources.use(await createTestRepository(repository, spawnGspot, prepareTestRepository));
});
afterAll(async () => {
    await resources.disposeAsync();
});

describe('the typescript configuration', () => {
    test('every check passes on the clean repository', async () => {
        const { root, environment } = testRepository;
        const whole = await spawnGspot(root, ['check'], environment);
        expect(whole.code, whole.stdout).toBe(0);
    });

    // typos forgets its exclude list for a file named on the command line unless it is told to keep it.
    test('spelling/typos keeps its exclusions for a file named on the command line', async () => {
        const { root, environment } = testRepository;
        const restore = await applyChanges(root, {
            check: 'spelling/typos',
            files: { 'assets/mark.svg': `<svg><title>${TYPO.the}</title></svg>\n` },
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
            await restore();
        }
    });
});
