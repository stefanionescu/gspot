// Test repository for the structure configuration: each repository-shape check fires on its test defect.
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { git } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { REPOSITORY } from '#tests/config/cli/checks/general/structure/findings.ts';

const resources = new AsyncDisposableStack();
let testRepository: OwnedTestRepository;
beforeAll(async () => {
    testRepository = resources.use(await createTestRepository(REPOSITORY, runGspot));
});
afterAll(async () => {
    await resources.disposeAsync();
});

describe('the structure configuration', () => {
    test('structure/tracked-dependencies reports a dependency folder that git tracks', async () => {
        const { root, environment } = testRepository;
        const command = ['check', '--only', 'structure/tracked-dependencies', '--json'];
        const clean = await runGspot(root, command, environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        await mkdir(join(root, 'web', 'node_modules', 'left-pad'), { recursive: true });
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
