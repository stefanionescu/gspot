import { STRICT_COMPILER_OPTIONS } from '#tests/config/checks/language/typescript.ts';

export const REACT_NATIVE_TSCONFIG = {
    compilerOptions: { ...STRICT_COMPILER_OPTIONS, module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx' },
    include: ['src'],
} as const;

export const NEXT_INSTALLATIONS = [
    {
        name: 'an uninstalled Next uses the shipped manifest pin',
        rootVersion: undefined,
        childVersion: undefined,
        expected: undefined,
    },
    {
        name: 'a hoisted installed Next supplies its major to root and child',
        rootVersion: '15.5.9',
        childVersion: undefined,
        expected: '^15',
    },
    {
        name: 'different installed versions within one major share that major',
        rootVersion: '16.3.6',
        childVersion: '16.3.5',
        expected: '^16',
    },
    {
        name: 'different selected installed majors refuse one shared plugin pin',
        rootVersion: '16.3.6',
        childVersion: '15.5.9',
        expected: 'conflict',
    },
] as const;

export const YARN_CLIENTS = [
    {
        packageManager: { name: 'yarn', version: '1.22.22' },
        lockfile: ['yarn', 'install'],
        install: ['yarn', 'install', '--frozen-lockfile'],
        settings: false,
    },
    {
        packageManager: { name: 'yarn', version: '4.12.0' },
        lockfile: ['yarn', 'install', '--mode=update-lockfile'],
        install: ['yarn', 'install', '--immutable'],
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
