// Public CLI journeys for document findings and tool failure recovery.
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { spawnGspot } from '#tests/harness/gspot.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareRepository } from '#tests/harness/repository.ts';
import { REPOSITORY } from '#tests/config/tools/configurations/general/markdown-docs-prose.ts';

const testRepository = shareRepository(() => REPOSITORY);

describe('the markdown, docs and prose configurations', () => {
    test('installation restores missing Vale dictionaries and the check accepts the restored styles', async () => {
        const { root: sandbox, environment } = testRepository();
        await rm(join(sandbox, '.gspot', 'vale', 'config', 'dictionaries'), {
            recursive: true,
        });
        const broken = await spawnGspot(sandbox, ['check', '--only', 'prose/vale', '--json'], environment);
        expect(broken.code, 'a Vale that cannot run is an error, never a pass').toBe(2);
        expect((JSON.parse(broken.stdout) as RunReport).checks).toMatchObject([
            { check: 'prose/vale', status: 'error' },
        ]);
        // Install reacquires the missing dictionaries through the install command in the diagnostic.
        const installed = await spawnGspot(sandbox, ['install'], environment);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const corrected = await spawnGspot(sandbox, ['check', '--only', 'prose/vale', '--json'], environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'prose/vale', status: 'passed', findings: [] },
        ]);
    });
});
