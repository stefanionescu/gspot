import { HOOKS_PATH } from '#cli/config/system/locations.ts';

export const HUSKY_PATH = '.husky';

export const LEFTHOOK_NAMES = ['lefthook', 'lefthook-local'] as const;
export const LEFTHOOK_PREFIXES = ['', '.', '.config/'] as const;
export const LEFTHOOK_EXTENSIONS = ['yml', 'yaml', 'toml', 'json', 'jsonc'] as const;

/** Hook managers can own tooling-only packages without gspot installing them. */
export const HOOK_PACKAGES: ReadonlySet<string> = new Set(['husky', 'lefthook', 'lint-staged']);

export const MISE_HOOKS_PATH = '.mise/tasks/hook';

/** Hook scripts keep their runner's names, including scripts nested beneath these folders. */
export const HOOK_FOLDERS = [HOOKS_PATH, MISE_HOOKS_PATH, '.githooks', HUSKY_PATH, '.git-hooks'] as const;

/** Git's configured hook folder. */
export const HOOKS_PATH_SETTING = 'core.hooksPath';

export const SIMPLE_GIT_HOOKS_KEY = 'simple-git-hooks';
export const PRE_COMMIT_FILE = '.pre-commit-config.yaml';
