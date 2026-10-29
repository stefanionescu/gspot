import { STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';

export const LICENSE_TOOL_CASES = [{ configurations: ['licenses'] }, { configurations: [] }] as const;

export const STYLESHEET_CASES = [
    { name: 'plain CSS', configurations: ['css'], files: { 'site.css': 'a { color: red; }' }, needsHtmlParser: true },
    {
        name: 'Vue styles',
        configurations: ['css', 'vue'],
        files: { 'Card.vue': '<template><p>Card</p></template><style>p { color: red; }</style>' },
        needsHtmlParser: true,
    },
    {
        name: 'Svelte styles',
        configurations: ['css', 'svelte'],
        files: { 'Card.svelte': '<p>Card</p><style>p { color: red; }</style>' },
        needsHtmlParser: true,
    },
    {
        name: 'Vue without Stylelint',
        configurations: ['vue'],
        files: { 'Card.vue': '<template><p>Card</p></template>' },
        needsHtmlParser: false,
    },
    {
        name: 'Svelte without Stylelint',
        configurations: ['svelte'],
        files: { 'Card.svelte': '<p>Card</p>' },
        needsHtmlParser: false,
    },
] as const;

export const REACT_NATIVE_TSCONFIG = {
    compilerOptions: {
        ...STRICT_COMPILER_OPTIONS,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
    },
    include: ['src'],
} as const;
