import { ANSWER_MODULE, COMPONENT_TSCONFIG } from '#tests/config/checks/component-samples.ts';

export const CLEAN_SVELTE = `<script lang="ts">
    const { name }: { name: string } = $props();
</script>

<p>{name}</p>
`;

export const SVELTE_SANDBOX = {
    configurations: ['typescript', 'svelte', 'css', 'format'],
    tsconfig: COMPONENT_TSCONFIG,
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
        // Stylelint reports the Vue function twice: as an unknown value and as an unknown function.
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
        // The shared TypeScript rules reach the component script.
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
                'src/SharedPolicy.svelte': `<script lang="ts">
const answer = 42;
</script>
<p>{answer}</p>
`,
            },
        },
    },
    {
        check: 'svelte/svelte-check',
        files: {
            'src/Product.svelte': `<script lang="ts">
    const { source }: { source: string } = $props();
</script>

<img src={source} />
`,
        },
        expected: { file: 'src/Product.svelte', rule: 'a11y_missing_attribute', line: 5 },
        corrected: {
            files: {
                'src/Product.svelte': `<script lang="ts">
    const { source }: { source: string } = $props();
</script>

<img src={source} alt="The product" />
`,
            },
        },
    },
    {
        check: 'svelte/svelte-check',
        files: {
            'src/Count.svelte': `<script lang="ts">
    const count: number = 'one';
</script>

<p>{count}</p>
`,
        },
        expected: { file: 'src/Count.svelte', rule: 'TS2322', line: 2 },
        corrected: {
            files: {
                'src/Count.svelte': `<script lang="ts">
    const count: number = 1;
</script>

<p>{count}</p>
`,
            },
        },
    },
    {
        // Stylelint reads the style block and accepts the scoping pseudo-class of Svelte.
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
