import { HOOKS_PATH } from '#cli/config/system/locations.ts';

const MISE_HOOKS_PATH = '.mise/tasks/hook';

export const HUSKY_PATH = '.husky';

export const LEFTHOOK_NAMES = ['lefthook', 'lefthook-local'] as const;
export const LEFTHOOK_PREFIXES = ['', '.', '.config/'] as const;
export const LEFTHOOK_EXTENSIONS = ['yml', 'yaml', 'toml', 'json', 'jsonc'] as const;

/** A tool-only package may hold these hook managers, and gspot does not install them. */
export const HOOK_PACKAGES: ReadonlySet<string> = new Set(['husky', 'lefthook', 'lint-staged']);

/** Folders of hook scripts, whose names the hook manager fixes; nested scripts count too. */
export const FOREIGN_HOOK_FOLDERS = ['.githooks', HUSKY_PATH, '.git-hooks'] as const;

export const HOOK_FOLDERS = [HOOKS_PATH, MISE_HOOKS_PATH, ...FOREIGN_HOOK_FOLDERS] as const;

/** The Git setting that names the hooks folder. */
export const HOOKS_PATH_SETTING = 'core.hooksPath';

export const SIMPLE_GIT_HOOKS_KEY = 'simple-git-hooks';
export const PRE_COMMIT_FILE = '.pre-commit-config.yaml';
