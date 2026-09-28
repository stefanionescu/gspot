// The literal values lifecycle/hooks reads: names, patterns, limits, and tables.
import type { HookTool } from '#cli/types/lifecycle/hooks.ts';

export const MANAGERS = new Set<string>(['simple-git-hooks', 'pre-commit', 'lefthook', 'husky']);
export const CONFIG_PATHS: Record<HookTool, string> = {
    'simple-git-hooks': 'package.json',
    'pre-commit': '.pre-commit-config.yaml',
    lefthook: 'lefthook.yml',
    husky: '',
};
