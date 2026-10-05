import { HOOKS_DIRECTORY } from '#cli/config/platform/locations.ts';

/** Hook managers can own tooling-only packages without being installed by gspot. */
export const HOOK_PACKAGES = ['husky', 'lefthook', 'lint-staged'];

export const MISE_HOOK_DIRECTORY = '.mise/tasks/hook';

/** Hook scripts keep their runner's names, including scripts nested beneath these folders. */
export const HOOK_DIRECTORIES = [HOOKS_DIRECTORY, MISE_HOOK_DIRECTORY, '.githooks', '.husky', '.git-hooks'];

export const HOOK_CONFIGURATION_FILES = [
    'lefthook.yml',
    '.lefthook.yml',
    'lefthook.yaml',
    '.lefthook.yaml',
    '.config/lefthook.yml',
    '.config/lefthook.yaml',
    'lefthook.toml',
    '.lefthook.toml',
    '.config/lefthook.toml',
    'lefthook.json',
    '.lefthook.json',
    '.config/lefthook.json',
    'lefthook.jsonc',
    '.lefthook.jsonc',
    '.config/lefthook.jsonc',
    'lefthook-local.yml',
    '.lefthook-local.yml',
    'lefthook-local.yaml',
    '.lefthook-local.yaml',
    '.config/lefthook-local.yml',
    '.config/lefthook-local.yaml',
    'lefthook-local.toml',
    '.lefthook-local.toml',
    '.config/lefthook-local.toml',
    'lefthook-local.json',
    '.lefthook-local.json',
    '.config/lefthook-local.json',
    'lefthook-local.jsonc',
    '.lefthook-local.jsonc',
    '.config/lefthook-local.jsonc',
    '.pre-commit-config.yaml',
];
