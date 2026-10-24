import { ANSWER_MODULE, COMPONENT_TSCONFIG } from '#tests/config/checks/component-samples.ts';

export const CLEAN_SVELTE =
    '<script lang="ts">\n    const { name }: { name: string } = $props();\n</script>\n\n<p>{name}</p>\n';

export const SVELTE_SANDBOX = {
    configurations: ['typescript', 'svelte', 'css', 'format'],
    json: { 'tsconfig.json': COMPONENT_TSCONFIG },
    files: {
        'src/answer.ts': ANSWER_MODULE,
        'src/Greeting.svelte': CLEAN_SVELTE,
    },
} as const;

export const SVELTE_CASES = [
    {
        check: 'css/stylelint',
        files: {
            'src/Binding.svelte': `<p>Card</p>
<style>
.card {
    color: v-bind(color);
}
</style>
`,
        },
        expected: { file: 'src/Binding.svelte', rule: 'function-no-unknown', line: 4 },
        findings: [
            { file: 'src/Binding.svelte', rule: 'declaration-property-value-no-unknown', line: 4 },
            { file: 'src/Binding.svelte', rule: 'function-no-unknown', line: 4 },
        ],
        corrected: {
            files: {
                'src/Binding.svelte': `<p>Card</p>
<style>
.card {
    color: red;
}
</style>
`,
            },
        },
    },
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
        check: 'svelte/svelte-check',
        files: {
            'src/Count.svelte': '<script lang="ts">\n    const count: number = \'one\';\n</script>\n\n<p>{count}</p>\n',
        },
        expected: { file: 'src/Count.svelte', rule: 'TS2322', line: 2 },
        corrected: {
            files: {
                'src/Count.svelte': '<script lang="ts">\n    const count: number = 1;\n</script>\n\n<p>{count}</p>\n',
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
