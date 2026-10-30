import { SETTINGS_FILE } from '#cli/config/settings/settings.ts';
import { PACKAGE_JSON, TSCONFIG_FILE, PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';

export const GIT_CHECK_IGNORE_ARGUMENTS = ['check-ignore', '--no-index', '-z', '--stdin'] as const;

export const FILES_BETWEEN_PAUSES = 64;

export const COPY_ROOT_FILES = [SETTINGS_FILE, PACKAGE_JSON, TSCONFIG_FILE, PYPROJECT_TOML] as const;

export const DEPENDENCY_FILES: ReadonlySet<string> = new Set([PACKAGE_JSON, PYPROJECT_TOML]);

export const GIT_HASH_ARGUMENTS = ['hash-object', '--stdin-paths'] as const;

export const OWNER_WRITABLE_FOLDER = 0o755;

export const GIT_SET_HEAD_ARGUMENTS = ['update-ref', '--no-deref', 'HEAD'] as const;

export const GIT_EMPTY_INDEX_ARGUMENTS = ['read-tree', '--empty'] as const;

export const GIT_UPDATE_INDEX_ARGUMENTS = ['update-index', '-z', '--index-info'] as const;

export const GIT_WRITE_TREE_ARGUMENTS = ['write-tree'] as const;

export const GIT_HASH_FORMAT_ARGUMENTS = ['rev-parse', '--show-object-format'] as const;

export const GIT_INIT_ARGUMENTS = ['init', '--quiet'] as const;

export const GIT_PATH_ARGUMENTS = ['rev-parse', '--path-format=absolute', '--git-path'] as const;

export const GIT_VERIFY_HEAD_ARGUMENTS = ['rev-parse', '--verify', 'HEAD'] as const;

export const DEPENDENCY_REVISION_NOTE =
    'The dependency files in the working tree differ from the checked revision; the checks used the installed dependencies.';

export const GIT_ALTERNATES_PATH = '.git/objects/info/alternates';

export const GIT_SHALLOW_PATH = '.git/shallow';

export const INSTALLED_DEPENDENCIES_MESSAGE =
    'Installed dependencies are tracked in the selected revision. Untrack them before checking again.';

export const DECLARATION_CONFIG_EXTENSIONS = new Set(['.json', '.jsonc']);

export const INSTALLED_VALE_MESSAGE =
    'The installed Vale packages do not match the Vale settings of this revision. Check this commit in its own clone after running gspot apply and gspot install there.';
