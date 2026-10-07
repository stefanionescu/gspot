import { HOOKS_DIRECTORY } from '#cli/config/platform/locations.ts';

export const LEFTHOOK_NAMES = ['lefthook', 'lefthook-local'];
export const LEFTHOOK_CONFIG_PREFIX = '.config/';
export const LEFTHOOK_PREFIXES = ['', '.', LEFTHOOK_CONFIG_PREFIX] as const;
export const LEFTHOOK_EXTENSIONS = ['yml', 'yaml', 'toml', 'json', 'jsonc'];
export const LEFTHOOK_YAML_EXTENSION_COUNT = 2;

/** Hook managers can own tooling-only packages without being installed by gspot. */
export const HOOK_PACKAGES = ['husky', 'lefthook', 'lint-staged'];

export const MISE_HOOK_DIRECTORY = '.mise/tasks/hook';

/** Hook scripts keep their runner's names, including scripts nested beneath these folders. */
export const HOOK_DIRECTORIES = [HOOKS_DIRECTORY, MISE_HOOK_DIRECTORY, '.githooks', '.husky', '.git-hooks'];
