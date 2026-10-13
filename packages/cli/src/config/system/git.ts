/** Git resolves scalar path variables relative to the original hook directory. */
export const GIT_PATH_VARIABLES = [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_COMMON_DIR',
    'GIT_GRAFT_FILE',
    'GIT_SHALLOW_FILE',
    'GIT_CONFIG',
] as const;

/** Command-scope configuration may supply authentication and applies to both repositories. */
export const GIT_COMMAND_CONFIGURATION = ['GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS'] as const;

export const GIT_ENVIRONMENT_NAME = /^GIT_[A-Z0-9_]+$/u;

/** These native commands create metadata instead of using the invoking repository's metadata. */
export const GIT_CLONE_COMMAND = 'clone';

/** Native Git executable names, including Windows. */
export const GIT_EXECUTABLE = 'git';

/** Git reports this exit code when repository discovery fails. */
export const NOT_REPOSITORY_CODE = 128;

/** The pager and command configuration do not select repository metadata. */
export const GIT_NONLOCAL_ENVIRONMENT_NAME = /^GIT_(?:PAGER|CONFIG_(?:COUNT|PARAMETERS|KEY_\d+|VALUE_\d+))$/u;

export const WORK_TREE_ARGV = ['rev-parse', '--is-inside-work-tree'] as const;
export const GIT_LOCALE = { LC_ALL: 'C' } as const;

export const GIT_DIR_VARIABLE = 'GIT_DIR';

export const GIT_PREFIX_ARGUMENTS = ['rev-parse', '--show-prefix'] as const;

export const GIT_LOCAL_VARIABLES_ARGV = ['rev-parse', '--local-env-vars'] as const;
export const GIT_SOURCE_ARGV = ['rev-parse', '--is-bare-repository', '--absolute-git-dir'] as const;
export const GIT_TOP_LEVEL_ARGV = ['rev-parse', '--show-toplevel'] as const;
export const GIT_DIRECTORY_ARGV = ['rev-parse', '--absolute-git-dir'] as const;

export const ORIGIN_URL_SETTING = 'remote.origin.url';

export const GIT_WORK_TREE_VARIABLE = 'GIT_WORK_TREE';
export const GIT_VARIABLE_PREFIX = 'GIT_';
export const NOT_REPOSITORY_MESSAGE = 'fatal: not a git repository (or any ';
export const GIT_SETTING_ARGV = ['config', '--null', '--get'] as const;
export const GIT_HOOKS_ARGV = ['rev-parse', '--git-path', 'hooks'] as const;
export const GIT_SHALLOW_ARGV = ['rev-parse', '--is-shallow-repository'] as const;
