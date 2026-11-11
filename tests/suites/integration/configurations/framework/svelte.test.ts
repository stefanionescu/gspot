import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { ANSWER_MODULE, COMPONENT_TSCONFIG } from '#tests/config/integration/framework.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const CLEAN_SVELTE =
    '<script lang="ts">\n    const { name }: { name: string } = $props();\n</script>\n\n<p>{name}</p>\n';

const SVELTE_SANDBOX = {
    configurations: ['typescript', 'svelte', 'css', 'format'],
    json: { 'tsconfig.json': COMPONENT_TSCONFIG },
    files: {
        'src/answer.ts': ANSWER_MODULE,
        'src/Greeting.svelte': CLEAN_SVELTE,
    },
} as const;

const SVELTE_CASES = [
    {
        check: 'javascript/eslint',
        files: {
            'src/SharedPolicy.svelte': `<script lang="ts">
function shout(text: string): string { return text.toUpperCase(); }
</script>
<p>{shout('hello')}</p>
`,
        },
        expected: { file: 'src/SharedPolicy.svelte', rule: 'gspot/no-trivial-functions', line: 2 },
        corrected: {
            files: {
                'src/SharedPolicy.svelte': '<script lang="ts">\nconst answer = 42;\n</script>\n<p>{answer}</p>\n',
            },
        },
    },
    {
        check: 'svelte/svelte-check',
        files: {
            'src/Product.svelte':
                '<script lang="ts">\n    const { source }: { source: string } = $props();\n</script>\n\n<img src={source} />\n',
        },
        expected: { file: 'src/Product.svelte', rule: 'a11y_missing_attribute', line: 5 },
        corrected: {
            files: {
                'src/Product.svelte':
                    '<script lang="ts">\n    const { source }: { source: string } = $props();\n</script>\n\n<img src={source} alt="The product" />\n',
            },
        },
    },
    {
        check: 'css/stylelint',
        files: {
            'src/Card.svelte': `<p class="card">card</p>

<style>
    :global(.card) {
        color: #ggg;
    }
</style>
`,
        },
        expected: { file: 'src/Card.svelte', rule: 'declaration-property-value-no-unknown', line: 5 },
        corrected: {
            files: {
                'src/Card.svelte': `<p class="card">card</p>

<style>
    :global(.card) {
        color: #abc;
    }
</style>
`,
            },
        },
    },
] as const;

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
