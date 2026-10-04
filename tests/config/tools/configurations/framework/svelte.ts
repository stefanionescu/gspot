import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG } from '#tests/config/samples/components.ts';

export const COUNT = '<script lang="ts">\n    const count: number = \'one\';\n</script>\n\n<p>{count}</p>\n';

export const SVELTE_CLEAN =
    '<script lang="ts">\n    const { name }: { name: string } = $props();\n</script>\n\n<p>{name}</p>\n';

export const PRODUCT =
    '<script lang="ts">\n    const { source }: { source: string } = $props();\n</script>\n\n<img src={source} />\n';

export const CARD =
    '<p class="card">card</p>\n\n<style>\n    :global(.card) {\n        color: #ggg;\n    }\n</style>\n';

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['typescript', 'svelte', 'css', 'format'],
    dependencies: { svelte: '5.57.0' },
    files: {
        'tsconfig.json': COMPONENT_TSCONFIG,
        'src/answer.ts': COMPONENT_SOURCE,
        'src/Greeting.svelte': SVELTE_CLEAN,
    },
};

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        // The shared TypeScript rules reach the component script.
        check: 'javascript/eslint',
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
            files: {
                'src/Product.svelte':
                    '<script lang="ts">\n    const { source }: { source: string } = $props();\n</script>\n\n<img src={source} alt="The product" />\n',
            },
        },
    },
    {
        check: 'svelte/check',
        files: { 'src/Count.svelte': COUNT },
        expected: { file: 'src/Count.svelte', rule: 'TS2322', line: 2 },
        corrected: {
            files: {
                'src/Count.svelte': '<script lang="ts">\n    const count: number = 1;\n</script>\n\n<p>{count}</p>\n',
            },
        },
    },
    {
        // Stylelint reads the style block and knows the scoping pseudo-class of Svelte.
        check: 'css/stylelint',
        files: { 'src/Card.svelte': CARD },
        expected: { file: 'src/Card.svelte', rule: 'declaration-property-value-no-unknown', line: 5 },
        corrected: {
            files: {
                'src/Card.svelte':
                    '<p class="card">card</p>\n\n<style>\n    :global(.card) {\n        color: #abc;\n    }\n</style>\n',
            },
        },
    },
];
