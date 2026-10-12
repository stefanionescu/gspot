import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { applyChanges } from '#tests/setup/files.ts';
import { containing } from '#tests/setup/matchers.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import svelteManifest from 'svelte/package.json' with { type: 'json' };
import { SVELTE_CASES, SVELTE_CLEAN, SVELTE_SANDBOX } from '#tests/config/svelte.ts';

const installedSandbox = shareInstalledSandbox({ ...SVELTE_SANDBOX, dependencies: { svelte: svelteManifest.version } });

test('Prettier reports and fixes a Svelte component through the Svelte plugin', async () => {
    const { root, environment } = installedSandbox();
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

for (const entry of SVELTE_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        await runCheckSample(installedSandbox(), entry, SVELTE_SANDBOX);
    });
}
