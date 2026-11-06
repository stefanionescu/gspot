import cliPackage from '#cli-package' with { type: 'json' };

export const SITE_TITLE = 'gspot';

export const REPOSITORY_URL = 'https://github.com/stefanionescu/gspot';

export const RELEASES_URL = `${REPOSITORY_URL}/releases`;

export const DOCS_PATH = '/start/quickstart/';

export const EDIT_URL = `${REPOSITORY_URL}/edit/main/docs/`;

export const THEME_STORAGE_KEY = 'starlight-theme';

export const THEME_SWITCH_LABELS = { dark: 'Switch to light theme', light: 'Switch to dark theme' } as const;

export const NPM_URL = `https://www.npmjs.com/package/${cliPackage.name}`;

export const README_OPENING_BLOCKS = 2;

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
            { slug: 'frameworks/expo' },
            { slug: 'frameworks/express' },
            { slug: 'frameworks/fastapi' },
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
            { slug: 'topics/testing' },
            { slug: 'topics/prose' },
            { slug: 'topics/site' },
            { slug: 'topics/real-catches' },
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
