import example from './example.json';

export const HERO_IMAGE = '/brand/home/hero.webp';
export const SUPPORTED_TOOLS = ['ESLint', 'Prettier', 'Ruff', 'Stylelint', 'ShellCheck', 'Semgrep'] as const;
export const SUPPORTED_LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'Swift', 'Bash', 'Markdown', 'CSS'] as const;
export const SUPPORTED_FRAMEWORKS = [
    'React',
    'Next.js',
    'Astro',
    'Vue',
    'Svelte',
    'React Native',
    'Expo',
    'Express',
    'NestJS',
    'FastAPI',
] as const;
export const INSTALL_COMMANDS = `${example.commands.install}\n${example.commands.init}\n${example.commands.install_tools}`;
export const CHECK_COMMANDS = `${example.commands.check}\nnpx gspot explain javascript/eslint`;

export const WORKFLOW_FEATURES = [
    {
        title: 'Configure the linters',
        description: 'gspot writes the configuration for the linters your languages need and pins their versions.',
        image: '/brand/home/toolchain.svg',
        href: '/reference/configurations/',
        link: 'Browse configurations',
    },
    {
        title: 'Catch what agents write',
        description: 'At level all, gspot reports unnecessary wrappers, catch-all names, and loose types.',
        image: '/brand/home/finding.svg',
        href: '/guides/findings/',
        link: 'Read and fix findings',
    },
    {
        title: 'Stop bad commits',
        description:
            'Git hooks run the checks on every commit and push. A finding stops the commit and says what to fix.',
        image: '/brand/home/policy.svg',
        href: '/guides/hooks/',
        link: 'Set up Git hooks',
    },
] as const;

export const REPOSITORY_FEATURES = [
    {
        title: 'Write rules for agents',
        description: 'gspot installs rules that describe how to write code, linked from AGENTS.md.',
        image: '/brand/home/agents.svg',
        href: '/guides/agents/',
        link: 'Set up coding agents',
    },
    {
        title: 'Keep one settings file',
        description:
            'Choose configurations, levels, limits, and exceptions in gspot.toml. Apply your settings to write every tool configuration.',
        image: '/brand/home/preservation.svg',
        href: '/guides/gspot-toml/',
        link: 'Customize your checks',
    },
    {
        title: 'Work in monorepos',
        description: 'Give each project its own configurations and settings, and check the files you changed.',
        image: '/brand/home/scopes.svg',
        href: '/guides/monorepos/',
        link: 'Set up monorepos',
    },
] as const;
