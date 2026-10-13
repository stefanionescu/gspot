export const WORKFLOW = [
    {
        title: 'Choose your checks',
        description:
            'Choose configurations and settings in gspot.toml. Apply those choices to generate configuration for the selected tools.',
        image: '/brand/home/policy.svg',
        href: '/guides/gspot-toml/',
        link: 'Choose checks and exceptions',
    },
    {
        title: 'Run pinned tool versions',
        description:
            'Run selected tools with pinned versions. ESLint, Ruff, Prettier, and other tools keep their own diagnostic rules.',
        image: '/brand/home/toolchain.svg',
        href: '/reference/configurations/',
        link: 'Browse the configuration reference',
    },
    {
        title: 'Find the code to fix',
        description:
            'Find the file, check, and correction advice in the report. Rerun the check after correcting the code.',
        image: '/brand/home/finding.svg',
        href: '/guides/findings/',
        link: 'Read and resolve findings',
    },
] as const;
export const REPOSITORY = [
    {
        title: 'Generate agent instructions',
        description:
            'Generate rule guides and agent entry points from your selected configurations. Keep instructions aligned with repository choices.',
        image: '/brand/home/agents.svg',
        href: '/guides/agents/',
        link: 'Configure agent instructions',
    },
    {
        title: 'Configure nested projects',
        description:
            'Use scopes for projects with different languages and settings. Run staged or changed-file checks for the work you are reviewing.',
        image: '/brand/home/scopes.svg',
        href: '/guides/monorepos/',
        link: 'Work with scopes',
    },
    {
        title: 'Review configuration changes',
        description:
            'Preview configuration changes, adopt supported existing settings, and inspect recovery copies when generated files have local edits.',
        image: '/brand/home/preservation.svg',
        href: '/guides/install/',
        link: 'Adopt an existing repository',
    },
] as const;

export const TOOLS = [
    { image: '/tools/eslint.svg', name: 'ESLint', colored: false },
    { image: '/tools/prettier.svg', name: 'Prettier', colored: false },
    { image: '/tools/ruff.svg', name: 'Ruff', colored: false },
    { image: '/tools/stylelint.svg', name: 'Stylelint', colored: false },
    { image: '/tools/shellcheck.png', name: 'ShellCheck', colored: true },
    { image: '/tools/semgrep.svg', name: 'Semgrep', colored: true },
] as const;

export const SEARCH_BUTTONS = 'site-search button[data-open-modal]';
