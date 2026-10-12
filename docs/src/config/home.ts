export const FEATURES = [
    {
        title: 'Check your source',
        description:
            'gspot configures standard linters. At level all, its own checks report unnecessary wrappers, one-file folders, and catch-all names.',
        href: '/guides/findings/',
        link: 'Read and fix findings',
    },
    {
        title: 'Stop bad commits',
        description:
            'Git hooks run the checks on every commit and push. A finding stops the commit and says what to fix.',
        href: '/guides/hooks/',
        link: 'Set up Git hooks',
    },
    {
        title: 'Write rules',
        description: 'gspot writes rules that describe how to write code, linked from AGENTS.md.',
        href: '/guides/agents/',
        link: 'Set up coding agents',
    },
] as const;
