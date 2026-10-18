/** The sidebar: one link per page, named by the page title, plus one to each long reference index. */
export const SIDEBAR = [
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
        label: 'Checks',
        collapsed: false,
        items: [
            { slug: 'checks/security' },
            { slug: 'checks/dependencies' },
            { slug: 'checks/testing' },
            { slug: 'checks/prose' },
        ],
    },
    {
        label: 'Reference',
        collapsed: false,
        items: [
            { label: 'Commands', collapsed: true, items: [{ autogenerate: { directory: 'reference/commands' } }] },
            { slug: 'reference/gspot-toml/index' },
            { slug: 'reference/configurations/index' },
            { slug: 'reference/checks/index' },
            {
                label: 'ESLint plugin',
                collapsed: true,
                items: [{ slug: 'reference/eslint-plugin/use' }, { slug: 'reference/eslint-plugin/index' }],
            },
            { slug: 'reference/environment-variables' },
            { slug: 'reference/json-output' },
            { slug: 'reference/generated-files' },
        ],
    },
];
