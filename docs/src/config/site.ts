import cliPackage from '#cli-package' with { type: 'json' };

// inline text
export const INLINE_CODE_SPAN = /(`[^`]+`)/u;

// readme opening
export const README_OPENING_BLOCKS = 2;

// sidebar
export const SIDEBAR = [
    {
        label: 'Start',
        collapsed: false,
        items: [
            { slug: 'start/quickstart' },
            { slug: 'start/concepts' },
            { slug: 'start/install' },
            { slug: 'start/migrate' },
            { slug: 'start/copy-settings' },
            { slug: 'start/upgrade' },
        ],
    },
    {
        label: 'Use',
        collapsed: false,
        items: [
            { slug: 'use/run-checks' },
            { slug: 'use/ignore' },
            { slug: 'use/hooks' },
            { slug: 'use/ci' },
            { slug: 'use/coding-agents' },
            { slug: 'use/editors' },
            { slug: 'use/troubleshooting' },
        ],
    },
    {
        label: 'Configure',
        collapsed: false,
        items: [
            { slug: 'configure/gspot-toml' },
            { slug: 'configure/lint-rules' },
            { slug: 'configure/import-rules' },
            { slug: 'configure/command-checks' },
            { slug: 'configure/monorepos' },
        ],
    },
    {
        label: 'Languages',
        collapsed: false,
        items: [
            { slug: 'languages/javascript-typescript' },
            { slug: 'languages/python' },
            { slug: 'languages/swift' },
            { slug: 'languages/css' },
            { slug: 'languages/bash' },
            { slug: 'languages/html' },
            { slug: 'languages/markdown' },
            { slug: 'languages/sql' },
        ],
    },
    {
        label: 'Frameworks',
        collapsed: false,
        items: [
            { slug: 'frameworks/astro' },
            { slug: 'frameworks/django' },
            { slug: 'frameworks/expo' },
            { slug: 'frameworks/express' },
            { slug: 'frameworks/fastapi' },
            { slug: 'frameworks/flask' },
            { slug: 'frameworks/nestjs' },
            { slug: 'frameworks/nextjs' },
            { slug: 'frameworks/react' },
            { slug: 'frameworks/react-native' },
            { slug: 'frameworks/svelte' },
            { slug: 'frameworks/vue' },
        ],
    },
    {
        label: 'Topics',
        collapsed: false,
        items: [
            { slug: 'topics/security' },
            { slug: 'topics/dependencies' },
            { slug: 'topics/licenses' },
            { slug: 'topics/testing' },
            { slug: 'topics/spelling' },
            { slug: 'topics/prose' },
            { slug: 'topics/site' },
        ],
    },
    {
        label: 'Reference',
        collapsed: false,
        items: [
            { slug: 'reference/commands/index' },
            { slug: 'reference/gspot-toml/index', label: 'Settings' },
            { slug: 'reference/configurations/index' },
            { slug: 'reference/checks/index' },
            { slug: 'reference/eslint-plugin/index', label: 'ESLint plugin' },
            { slug: 'reference/json-output' },
            { slug: 'reference/generated-files' },
            { slug: 'reference/changelog' },
        ],
    },
];
export const WIDE_SCREEN_QUERY = '(min-width: 50em)';

// site identity
export const BACKGROUND_COLOR = '#0b1020';
export const SITE_TITLE = 'gspot';

// site links
export const DOCS_PATH = '/start/quickstart/';
export const REPOSITORY_URL = 'https://github.com/stefanionescu/gspot';
export const EDIT_URL = `${REPOSITORY_URL}/edit/main/docs/`;
export const NPM_URL = `https://www.npmjs.com/package/${cliPackage.name}`;
export const RELEASES_URL = `${REPOSITORY_URL}/releases`;

// social images
export const SECTION_IMAGES = new Map([
    ['start', { name: 'Start', path: '/social/start.png' }],
    ['use', { name: 'Use', path: '/social/use.png' }],
    ['configure', { name: 'Configure', path: '/social/configure.png' }],
    ['languages', { name: 'Languages', path: '/social/languages.png' }],
    ['frameworks', { name: 'Frameworks', path: '/social/frameworks.png' }],
    ['topics', { name: 'Topics', path: '/social/topics.png' }],
    ['reference', { name: 'Reference', path: '/social/reference.png' }],
]);
export const SECTION_SEGMENT = /^\/(?<section>[^/]+)\//u;
export const SOCIAL_IMAGE = {
    path: '/open-graph.png',
    alt: 'The gspot name and logo.',
    width: 1200,
    height: 630,
} as const;

// theme switch
export const THEME_STORAGE_KEY = 'starlight-theme';
export const THEME_SWITCH_LABELS = { dark: 'Switch to light theme', light: 'Switch to dark theme' } as const;
