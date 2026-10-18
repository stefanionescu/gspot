/** The fixed sidebar groups: one link per page, named by the page title. */
export const SIDEBAR_GROUPS = [
    {
        label: 'Getting started',
        collapsed: false,
        items: [
            { slug: 'start/overview' },
            { slug: 'start/quickstart' },
            { slug: 'start/install' },
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
            { slug: 'configure/monorepos' },
            { slug: 'configure/command-checks' },
            { slug: 'configure/share-settings' },
        ],
    },
    {
        label: 'Guides',
        collapsed: false,
        items: [
            { slug: 'languages/javascript-typescript' },
            { slug: 'languages/python' },
            { slug: 'languages/swift' },
            { slug: 'languages/css' },
            { slug: 'checks/security' },
            { slug: 'checks/dependencies' },
            { slug: 'checks/testing' },
            { slug: 'checks/prose' },
        ],
    },
];

export const REFERENCE_LABEL = 'Reference';

/** The Reference groups that list every generated check or configuration page, by area. */
export const REFERENCE_LISTS = [
    { label: 'Checks', indexLabel: 'All checks', kind: 'checks' },
    { label: 'Configurations', indexLabel: 'All configurations', kind: 'configurations' },
] as const;

/** The Reference links before the generated lists. */
export const REFERENCE_START = [
    { label: 'Commands', collapsed: true, items: [{ autogenerate: { directory: 'reference/commands' } }] },
];

/** The Reference links after the generated lists. */
export const REFERENCE_END = [
    { slug: 'reference/gspot-toml/index' },
    {
        label: 'ESLint plugin',
        collapsed: true,
        items: [{ slug: 'reference/eslint-plugin/use' }, { slug: 'reference/eslint-plugin/index' }],
    },
    { slug: 'reference/environment-variables' },
    { slug: 'reference/json-output' },
    { slug: 'reference/generated-files' },
];
