export const NEXT_REQUIREMENTS = [
    {
        name: 'an uninstalled project',
        rootRange: '^15.5.0',
        childRange: undefined,
        rootVersion: undefined,
        childVersion: undefined,
    },
    {
        name: 'unrelated installed packages',
        rootRange: '^15.5.0',
        childRange: undefined,
        rootVersion: '16.3.6',
        childVersion: '16.3.5',
    },
    {
        name: 'matching declared majors',
        rootRange: '^16.3.6',
        childRange: '~16.3.5',
        rootVersion: undefined,
        childVersion: undefined,
    },
    {
        name: 'conflicting declared majors',
        rootRange: '^16.3.6',
        childRange: '^15.5.9',
        rootVersion: undefined,
        childVersion: undefined,
    },
    {
        name: 'a catalog reference',
        rootRange: 'catalog:',
        childRange: undefined,
        rootVersion: '15.5.9',
        childVersion: undefined,
    },
    {
        name: 'a workspace reference',
        rootRange: 'workspace:*',
        childRange: undefined,
        rootVersion: '15.5.9',
        childVersion: undefined,
    },
    {
        name: 'a tag',
        rootRange: 'latest',
        childRange: undefined,
        rootVersion: '15.5.9',
        childVersion: undefined,
    },
] as const;

export const YARN_CLIENTS = [
    {
        packageManager: { name: 'yarn', version: '1.22.22' },
        settings: false,
    },
    {
        packageManager: { name: 'yarn', version: '4.12.0' },
        settings: true,
    },
] as const;

export const NEXTJS_API_SETTINGS = {
    scopes: [
        { path: 'web', configurations: ['nextjs'] },
        { path: 'api', configurations: ['javascript'] },
    ],
} as const;

export const LICENSE_TOOL_CASES = [{ configurations: ['licenses'] }, { configurations: [] }] as const;

export const STYLESHEET_CASES = [
    { name: 'plain CSS', configurations: ['css'], files: { 'site.css': 'a { color: red; }' }, needsHtmlParser: false },
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
