import type { FeatureProps } from '../types/components.ts';

/** Features grounded in supported check and instruction behavior. */
export const FEATURES: FeatureProps['features'] = [
    {
        title: 'Check your source',
        description:
            'gspot configures standard linters. At level all, its own checks report unnecessary wrappers, one-file folders, and catch-all names.',
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
    {
        title: 'Write agent rules',
        description: 'gspot writes agent rules that describe how to write code, linked from AGENTS.md.',
        image: '/brand/home/agents.svg',
        href: '/guides/agents/',
        link: 'Set up coding agents',
    },
];
