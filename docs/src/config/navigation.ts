import { REFERENCE_FOLDERS } from './reference.ts';

export const SIDEBAR = [
    {
        label: 'Get started',
        collapsed: false,
        items: [
            { label: 'What gspot does', slug: 'guides/overview' },
            { label: 'Install', slug: 'guides/install' },
            { label: 'Quickstart: JavaScript and TypeScript', slug: 'guides/quickstart/javascript-typescript' },
            { label: 'Quickstart: Python', slug: 'guides/quickstart/python' },
            { label: 'Quickstart: Swift', slug: 'guides/quickstart/swift' },
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
            { label: 'gspot.toml', slug: 'guides/gspot-toml' },
            { label: 'Exclude files and ignore findings', slug: 'guides/exclude' },
            { label: 'Monorepos', slug: 'guides/monorepos' },
            { label: 'Command checks', slug: 'guides/command-checks' },
            { label: 'Reuse templates', slug: 'guides/templates' },
            { label: 'Generated files', slug: 'guides/generated-files' },
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
            {
                label: 'Commands',
                collapsed: true,
                items: [{ autogenerate: { directory: `reference/${REFERENCE_FOLDERS.commands}` } }],
            },
            {
                label: 'Configurations',
                collapsed: true,
                items: [{ autogenerate: { directory: `reference/${REFERENCE_FOLDERS.configurations}` } }],
            },
            {
                label: 'Checks',
                collapsed: true,
                items: [{ autogenerate: { directory: `reference/${REFERENCE_FOLDERS.checks}` } }],
            },
            {
                label: 'ESLint plugin',
                collapsed: true,
                items: [{ autogenerate: { directory: `reference/${REFERENCE_FOLDERS.eslintPlugin}` } }],
            },
            { label: 'gspot.toml reference', slug: 'reference/gspot-toml' },
            { label: 'Exit codes and environment variables', slug: 'reference/exit-codes' },
        ],
    },
] as const;
