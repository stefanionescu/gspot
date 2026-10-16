import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';

export const FILES_BETWEEN_PAUSES = 64;

export const SCRATCH_EXTRAS = [SETTINGS_FILE, PACKAGE_JSON, TSCONFIG_FILE, PYPROJECT_TOML] as const;

/** A project manifest marks a folder whose installed dependencies a scratch copy carries. */
export const DEPENDENCY_FILES: ReadonlySet<string> = new Set([PACKAGE_JSON, PYPROJECT_TOML]);

export const GIT_HASH_PATHS = ['hash-object', '--stdin-paths'] as const;
export const GIT_SHARED_CLONE = ['clone', '--shared', '--no-checkout', '--quiet', '--'] as const;
export const GIT_SET_HEAD = ['update-ref', '--no-deref', 'HEAD'] as const;
export const GIT_EMPTY_INDEX = ['read-tree', '--empty'] as const;
export const GIT_WRITE_TREE = ['write-tree'] as const;
export const GIT_UPDATE_INDEX = ['update-index', '-z', '--index-info'] as const;

export const GIT_IGNORED_PATHS = ['check-ignore', '--no-index', '-z', '--stdin'] as const;
