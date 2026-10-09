import type { Sidebar } from '../types/components.ts';

/** Navigation follows the reader's setup, daily use, and configuration tasks. */
export const SIDEBAR: Sidebar = [
    {
        label: 'Get started',
        collapsed: false,
        items: [
            { label: 'What gspot does', slug: 'guides/overview' },
            { label: 'Requirements', slug: 'guides/requirements' },
            { label: 'Install', slug: 'guides/install' },
            { label: 'Quickstart: TypeScript', slug: 'guides/quickstart/typescript' },
            { label: 'Quickstart: Python', slug: 'guides/quickstart/python' },
            { label: 'Quickstart: Swift', slug: 'guides/quickstart/swift' },
            { label: 'Add to an existing repository', slug: 'guides/existing-repository' },
            { label: 'Join a repository', slug: 'guides/join' },
        ],
    },
    {
        label: 'Daily use',
        collapsed: false,
        items: [
            { label: 'Fix findings', slug: 'guides/findings' },
            { label: 'Git hooks', slug: 'guides/hooks' },
            { label: 'CI', slug: 'guides/ci' },
            { label: 'Coding agents', slug: 'guides/agents' },
        ],
    },
    {
        label: 'Configure',
        collapsed: false,
        items: [
            { label: 'gspot.toml', slug: 'guides/policy' },
            { label: 'Exclude files', slug: 'guides/exclude' },
            { label: 'Monorepos', slug: 'guides/monorepos' },
            { label: 'Runners', slug: 'guides/runners' },
            { label: 'Generated files', slug: 'guides/generated-files' },
            { label: 'Command checks', slug: 'guides/command-checks' },
            { label: 'Reuse templates', slug: 'guides/templates' },
            { label: 'Upgrade gspot', slug: 'guides/upgrade' },
            { label: 'Remove gspot', slug: 'guides/remove' },
        ],
    },
    {
        label: 'Topics',
        collapsed: true,
        items: [
            { label: 'Tests and coverage', slug: 'guides/testing' },
            { label: 'Dependency licenses', slug: 'guides/dependency-licenses' },
            { label: 'Security', slug: 'guides/security' },
        ],
    },
    { label: 'Troubleshooting', slug: 'guides/troubleshooting' },
    {
        label: 'Reference',
        collapsed: true,
        items: [
            { label: 'Commands', collapsed: true, items: [{ autogenerate: { directory: 'reference/commands' } }] },
            {
                label: 'Configurations',
                collapsed: true,
                items: [{ autogenerate: { directory: 'reference/configurations' } }],
            },
            { label: 'Checks', collapsed: true, items: [{ autogenerate: { directory: 'reference/checks' } }] },
            { label: 'ESLint plugin', collapsed: true, items: [{ autogenerate: { directory: 'reference/plugin' } }] },
            { label: 'Settings', slug: 'reference/settings' },
            { label: 'gspot.toml schema', slug: 'reference/gspot-toml' },
            { label: 'Exit codes and environment variables', slug: 'reference/runtime' },
        ],
    },
];
