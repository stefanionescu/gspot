import { ANSWER_MODULE, COMPONENT_TSCONFIG } from '#tests/data/checks/component-samples.ts';

export const SVELTE_PROJECTS = [
    {
        name: 'root JavaScript',
        scope: '',
        settings: `configurations = ["svelte"]
[[scope]]
path = "app"

`,
        authored: false,
    },
    {
        name: 'scoped TypeScript',
        scope: 'app',
        settings: `configurations = ["svelte", "typescript"]
[[scope]]
path = "app"

`,
        authored: true,
    },
] as const;

/** svelte-check output with errors, warnings, and source locations. */
export const SVELTE_CHECK_OUTPUT = `1758823456789 START "/repo"
1758823456790 {"type":"ERROR","filename":"src/Count.svelte","start":{"line":1,"character":10},"end":{"line":1,"character":15},"message":"Type 'string' is not assignable to type 'number'.","code":2322,"source":"ts"}
1758823456791 {"type":"WARNING","filename":"src/Product.svelte","start":{"line":4,"character":0},"end":{"line":4,"character":20},"message":"\`<img>\` element should have an alt attribute","code":"a11y_missing_attribute","source":"svelte"}
1758823456792 COMPLETED 2 FILES 1 ERRORS 1 WARNINGS 2 FILES_WITH_PROBLEMS`;

export const SVELTE_CLEAN = `<script lang="ts">
    const { name }: { name: string } = $props();
</script>

<p>{name}</p>
`;

export const SVELTE_SANDBOX = {
    configurations: ['typescript', 'svelte', 'css', 'format'],
    tsconfig: COMPONENT_TSCONFIG,
    files: {
        'src/answer.ts': ANSWER_MODULE,
        'src/Greeting.svelte': SVELTE_CLEAN,
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
function forward(value: any) { return build(value); }
</script>
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
