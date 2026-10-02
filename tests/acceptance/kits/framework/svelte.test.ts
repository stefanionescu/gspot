// One installed Svelte repository: the shared rules inside component scripts, svelte-check, the style block, the
// takeover of tsc, and Prettier through the Svelte plugin.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG } from '#tests/samples/components.ts';

const SVELTE_CLEAN =
    '<script lang="ts">\n    const { name }: { name: string } = $props();\n</script>\n\n<p>{name}</p>\n';

const COUNT = '<script lang="ts">\n    const count: number = \'one\';\n</script>\n\n<p>{count}</p>\n';

const PRODUCT =
    '<script lang="ts">\n    const { source }: { source: string } = $props();\n</script>\n\n<img src={source} />\n';

const CARD = '<p class="card">card</p>\n\n<style>\n    :global(.card) {\n        color: #ggg;\n    }\n</style>\n';

plantedCases(
    'the svelte kit',
    {
        kits: ['typescript', 'svelte', 'css', 'formatting'],
        dependencies: { svelte: '5.57.0' },
        files: {
            'tsconfig.json': COMPONENT_TSCONFIG,
            'src/answer.ts': COMPONENT_SOURCE,
            'src/Greeting.svelte': SVELTE_CLEAN,
        },
    },
    [
        {
            // The shared TypeScript rules reach the component script.
            check: 'svelte/eslint',
            files: {
                'src/SharedPolicy.svelte':
                    '<script lang="ts">\nfunction forward(value: any) { return build(value); }\n</script>\n',
            },
            expected: { file: 'src/SharedPolicy.svelte', rule: 'gspot/no-trivial-functions', line: 2 },
            corrected: {
                files: {
                    'src/SharedPolicy.svelte': '<script lang="ts">\nconst answer = 42;\n</script>\n<p>{answer}</p>\n',
                },
            },
        },
        {
            check: 'svelte/check',
            files: { 'src/Product.svelte': PRODUCT },
            expected: { file: 'src/Product.svelte', rule: 'a11y_missing_attribute', line: 5 },
            corrected: {
                files: { 'src/Product.svelte': PRODUCT.replace('src={source}', 'src={source} alt="The product"') },
            },
        },
        {
            check: 'svelte/check',
            files: { 'src/Count.svelte': COUNT },
            expected: { file: 'src/Count.svelte', rule: 'TS2322', line: 2 },
            corrected: { files: { 'src/Count.svelte': COUNT.replace("'one'", '1') } },
        },
        {
            // Stylelint reads the style block and knows the scoping pseudo-class of Svelte.
            check: 'css/stylelint',
            files: { 'src/Card.svelte': CARD },
            expected: { file: 'src/Card.svelte', rule: 'declaration-property-value-no-unknown', line: 5 },
            corrected: { files: { 'src/Card.svelte': CARD.replace('#ggg', '#abc') } },
        },
    ],
    (installed) => {
        test(
            'svelte/check takes over typescript/tsc',
            async () => {
                const { root, environment } = installed();
                const both = await spawnGspot(
                    root,
                    ['check', '--json', '--only', 'typescript/tsc', 'svelte/check'],
                    environment,
                );
                expect(both.code, both.stdout + both.stderr).toBe(0);
                expect((JSON.parse(both.stdout) as RunReport).checks).toContainEqual(
                    containing({ check: 'typescript/tsc', status: 'skipped', note: 'svelte/check runs it here' }),
                );
            },
            PLANTED_TIMEOUT_MS * 2,
        );

        test(
            'formatting/prettier reports and corrects a component through the Svelte plugin',
            async () => {
                const { root, environment } = installed();
                const path = join(root, 'src/Greeting.svelte');
                await Bun.write(
                    path,
                    SVELTE_CLEAN.replace('<p>', () => '<p     >'),
                );
                const loose = await spawnGspot(root, ['check', '--only', 'formatting/prettier', '--json'], environment);
                expect(loose.code, loose.stdout + loose.stderr).toBe(1);
                expect((JSON.parse(loose.stdout) as RunReport).checks[0]!.findings).toContainEqual(
                    containing({ file: 'src/Greeting.svelte' }),
                );
                const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'formatting/prettier'], environment);
                expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
                expect(await Bun.file(path).text()).toBe(SVELTE_CLEAN);
            },
            PLANTED_TIMEOUT_MS * 2,
        );
    },
);
