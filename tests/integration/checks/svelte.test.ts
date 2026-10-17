import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import svelteManifest from 'svelte/package.json' with { type: 'json' };
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { SVELTE_CASES, SVELTE_CLEAN, SVELTE_SANDBOX } from '#tests/data/checks/svelte.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

const installedSandbox = registerSharedSandbox({ ...SVELTE_SANDBOX, dependencies: { svelte: svelteManifest.version } });

test('Prettier reports and fixes a Svelte component through the Svelte plugin', async () => {
    const { root, environment } = installedSandbox();
    const path = join(root, 'src/Greeting.svelte');
    await using _change = await updateSandbox(
        { root, environment: {}, run: spawnGspot },
        {
            check: 'format/prettier',
            files: { 'src/Greeting.svelte': SVELTE_CLEAN.replace('<p>', '<p     >') },
        },
    );

    const loose = await spawnGspot(root, ['check', '--only', 'format/prettier', '--json'], environment);

    expect(loose.code, loose.stdout + loose.stderr).toBe(1);

    expect((JSON.parse(loose.stdout) as RunReport).checks[0]!.findings).toContainEqual(
        matchFields({ file: 'src/Greeting.svelte' }),
    );

    const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'format/prettier'], environment);

    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);

    expect(await Bun.file(path).text()).toBe(SVELTE_CLEAN);
});

test.each([...SVELTE_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, SVELTE_SANDBOX);
    expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
});
