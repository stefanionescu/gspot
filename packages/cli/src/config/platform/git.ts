/** The default deadline shared by every Git command. */
export const GIT_TIMEOUT_MS = 30_000;

/** Git's scalar path variables are relative to the original hook working directory. */
export const GIT_PATH_VARIABLES = [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_COMMON_DIR',
    'GIT_GRAFT_FILE',
    'GIT_SHALLOW_FILE',
    'GIT_CONFIG',
];

/** Command-scope configuration may supply authentication and applies to both repositories. */
export const GIT_COMMAND_CONFIGURATION = ['GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS'];

export const GIT_ENVIRONMENT_NAME = /^GIT_[A-Z0-9_]+$/u;

/** These native commands create metadata instead of using the invoking repository's metadata. */
export const GIT_CREATION_COMMANDS = new Set<string | undefined>(['clone', 'init']);

/** Native Git executable names, including Windows. */
export const GIT_EXECUTABLES = new Set(['git', 'git.exe']);

/** Git reports this exit code when repository discovery fails. */
export const NOT_REPOSITORY_CODE = 128;

/** The pager and command configuration do not select repository metadata. */
export const GIT_NONLOCAL_ENVIRONMENT_NAME = /^GIT_(?:PAGER|CONFIG_(?:COUNT|PARAMETERS|KEY_\d+|VALUE_\d+))$/u;
