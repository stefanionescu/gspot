import { SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers/dependencies.ts';

export const FILES_BETWEEN_PAUSES = 64;

export const COPY_ROOT_FILES = [SETTINGS_FILE, PACKAGE_JSON, TSCONFIG_FILE, PYPROJECT_TOML] as const;

/** A project file marks a folder whose installed dependencies a copy carries. */
export const DEPENDENCY_FILES: ReadonlySet<string> = new Set([PACKAGE_JSON, PYPROJECT_TOML]);

export const GIT_HASH_ARGUMENTS = ['hash-object', '--stdin-paths'] as const;
export const GIT_SHARED_CLONE_ARGUMENTS = ['clone', '--shared', '--no-checkout', '--quiet', '--'] as const;
export const GIT_SET_HEAD_ARGUMENTS = ['update-ref', '--no-deref', 'HEAD'] as const;
export const GIT_EMPTY_INDEX_ARGUMENTS = ['read-tree', '--empty'] as const;
export const GIT_WRITE_TREE_ARGUMENTS = ['write-tree'] as const;
export const GIT_UPDATE_INDEX_ARGUMENTS = ['update-index', '-z', '--index-info'] as const;

export const GIT_CHECK_IGNORE_ARGUMENTS = ['check-ignore', '--no-index', '-z', '--stdin'] as const;
