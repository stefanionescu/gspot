import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { SVELTE_CASES, CLEAN_SVELTE, SVELTE_SANDBOX } from '#tests/config/integration/checks/framework/framework.ts';

const installedSandbox = shareInstalledSandbox({
    ...SVELTE_SANDBOX,
    dependencies: { svelte: SANDBOX_PACKAGES.svelte },
});

test('Prettier reports and fixes a Svelte component through the Svelte plugin', async () => {
    const { root } = installedSandbox();
    const path = join(root, 'src/Greeting.svelte');
    await using _change = await changeSandbox(installedSandbox(), {
        files: { 'src/Greeting.svelte': CLEAN_SVELTE.replace('<p>', '<p     >') },
    });

    const loose = parseCheckReport(await spawnGspot(root, ['check', '--only', 'format/prettier', '--json']));
    expect(loose.code, loose.stdout + loose.stderr).toBe(1);
    expect(loose.report.checks).toMatchObject([
        { check: 'format/prettier', status: 'failed', findings: [matchFields({ file: 'src/Greeting.svelte' })] },
    ]);
    const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'format/prettier']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(path, 'utf8')).toBe(CLEAN_SVELTE);
});

test.each([...SVELTE_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
