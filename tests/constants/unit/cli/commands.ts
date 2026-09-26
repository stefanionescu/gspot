// The literal values unit/cli/commands reads: names, patterns, limits, and tables.
import type { CarriedConfiguration } from '#cli/types/policy/adoption.ts';

export const CONFIGURATIONS = [
    'typescript',
    'javascript',
    'react',
    'nextjs',
    'css',
    'html',
    'markdown',
    'prose',
    'spelling',
    'commits',
    'configs',
    'naming',
    'formatting',
    'docs',
    'secrets',
    'dependencies',
    'licenses',
];
export const NOTHING_CARRIED: CarriedConfiguration = {
    tools: new Map(),
    scopes: new Map(),
    observed: new Map(),
    removed: [],
    unread: [],
    retained: [],
};
