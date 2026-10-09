// One installed Svelte repository: the shared rules inside component scripts, svelte-check, the style block, the
// Prettier through the Svelte plugin.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { containing } from '#tests/harness/expectations.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareRepository } from '#tests/harness/repository.ts';
import svelteManifest from 'svelte/package.json' with { type: 'json' };
import { REPOSITORY, SVELTE_CLEAN } from '#tests/config/tools/configurations/framework/svelte.ts';

const testRepository = shareRepository(() => ({ ...REPOSITORY, dependencies: { svelte: svelteManifest.version } }));

test('format/prettier reports and corrects a component through the Svelte plugin', async () => {
    const { root, environment } = testRepository();
    const path = join(root, 'src/Greeting.svelte');
    const restore = await applyChanges(root, {
        check: 'format/prettier',
        files: { 'src/Greeting.svelte': SVELTE_CLEAN.replace('<p>', '<p     >') },
    });
    try {
        const loose = await spawnGspot(root, ['check', '--only', 'format/prettier', '--json'], environment);
        expect(loose.code, loose.stdout + loose.stderr).toBe(1);
        expect((JSON.parse(loose.stdout) as RunReport).checks[0]!.findings).toContainEqual(
            containing({ file: 'src/Greeting.svelte' }),
        );
        const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'format/prettier'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(path).text()).toBe(SVELTE_CLEAN);
    } finally {
        await restore();
    }
});
