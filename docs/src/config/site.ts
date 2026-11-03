import cliPackage from '#cli-package' with { type: 'json' };

export const SITE_TITLE = 'gspot';

export const REPOSITORY_URL = 'https://github.com/stefanionescu/gspot';

export const RELEASES_URL = `${REPOSITORY_URL}/releases`;

export const DOCS_PATH = '/start/overview/';

export const EDIT_URL = `${REPOSITORY_URL}/edit/main/docs/`;

export const THEME_STORAGE_KEY = 'starlight-theme';

export const THEME_SWITCH_LABELS = { dark: 'Switch to light theme', light: 'Switch to dark theme' } as const;

export const NPM_URL = `https://www.npmjs.com/package/${cliPackage.name}`;

export const README_OPENING_BLOCKS = 2;

export const SIDEBAR = [
    {
        label: 'Basics',
        collapsed: false,
        items: [
            { slug: 'start/overview' },
            { slug: 'start/quickstart' },
            { slug: 'start/install' },
            { slug: 'start/footprint' },
            { slug: 'start/migrate' },
            { slug: 'start/upgrade' },
            { slug: 'start/concepts' },
        ],
    },
    {
        label: 'Usage',
        collapsed: false,
        items: [
            { slug: 'use/run-checks' },
            { slug: 'use/ignore' },
            { slug: 'use/hooks' },
            { slug: 'use/ci' },
            { slug: 'use/editors' },
            { slug: 'use/coding-agents' },
            { slug: 'use/troubleshooting' },
        ],
    },
    {
        label: 'Configuration',
        collapsed: false,
        items: [
            { slug: 'configure/gspot-toml' },
            { slug: 'configure/files' },
            { slug: 'configure/lint-rules' },
            { slug: 'configure/import-rules' },
            { slug: 'configure/monorepos' },
            { slug: 'configure/command-checks' },
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
        ],
    },
    {
        label: 'Topics',
        collapsed: false,
        items: [
            { slug: 'topics/security' },
            { slug: 'topics/dependencies' },
            { slug: 'topics/testing' },
            { slug: 'topics/site' },
            { slug: 'topics/prose' },
        ],
    },
    {
        label: 'Reference',
        collapsed: false,
        items: [
            { slug: 'reference/commands/index' },
            { slug: 'reference/checks/index' },
            { slug: 'reference/configurations/index' },
            { slug: 'reference/gspot-toml/index' },
            { slug: 'reference/eslint-plugin/index' },
            { slug: 'reference/json-output' },
            { slug: 'reference/generated-files' },
        ],
    },
];
