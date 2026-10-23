import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import sveltePackage from 'svelte/package.json' with { type: 'json' };
import { changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';
import { SVELTE_CASES, CLEAN_SVELTE, SVELTE_SANDBOX } from '#tests/config/integration/checks/framework/svelte.ts';

const installedSandbox = shareInstalledSandbox({ ...SVELTE_SANDBOX, dependencies: { svelte: sveltePackage.version } });

test('Prettier reports and fixes a Svelte component through the Svelte plugin', async () => {
    const { root, environment } = installedSandbox();
    const path = join(root, 'src/Greeting.svelte');
    await using _change = await changeAppliedSandbox(installedSandbox(), {
        check: 'format/prettier',
        files: { 'src/Greeting.svelte': CLEAN_SVELTE.replace('<p>', '<p     >') },
    });

    const loose = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'format/prettier', '--json'], environment),
    );
    expect(loose.code, loose.stdout + loose.stderr).toBe(1);
    expect(loose.report.checks).toMatchObject([
        { check: 'format/prettier', status: 'failed', findings: [matchFields({ file: 'src/Greeting.svelte' })] },
    ]);
    const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'format/prettier'], environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(path, 'utf8')).toBe(CLEAN_SVELTE);
});

test.each([...SVELTE_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
    const result = await runCheckSample(installedSandbox(), sample, SVELTE_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
});
