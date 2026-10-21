/** Git resolves these single-path variables relative to the original hook folder. */
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

/** Git settings from the command line may carry credentials, and apply to both repositories. */
export const GIT_COMMAND_CONFIGURATION: ReadonlySet<string> = new Set(['GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS']);

/** This command creates new Git metadata and does not read the metadata of the calling repository. */
export const GIT_CLONE_COMMAND = 'clone';

/** The Git executable name on every system. */
export const GIT_EXECUTABLE = 'git';

/** Git reports this exit code when repository discovery fails. */
export const NOT_REPOSITORY_CODE = 128;

/** The pager and command configuration do not select repository metadata. */
export const GIT_NONLOCAL_ENVIRONMENT_NAME = /^GIT_(?:PAGER|CONFIG_(?:COUNT|PARAMETERS|KEY_\d+|VALUE_\d+))$/u;

export const WORK_TREE_ARGUMENTS = ['rev-parse', '--is-inside-work-tree'] as const;
export const GIT_LOCALE = { LC_ALL: 'C' } as const;

export const GIT_DIR_VARIABLE = 'GIT_DIR';

export const GIT_LOCAL_VARIABLES_ARGUMENTS = ['rev-parse', '--local-env-vars'] as const;
export const GIT_SOURCE_ARGUMENTS = ['rev-parse', '--is-bare-repository', '--absolute-git-dir'] as const;
export const GIT_TOP_LEVEL_ARGUMENTS = ['rev-parse', '--show-toplevel'] as const;
export const GIT_FOLDER_ARGUMENTS = ['rev-parse', '--absolute-git-dir'] as const;

export const ORIGIN_URL_SETTING = 'remote.origin.url';

export const GIT_WORK_TREE_VARIABLE = 'GIT_WORK_TREE';
export const GIT_VARIABLE_PREFIX = 'GIT_';
export const NOT_REPOSITORY_MESSAGE = 'fatal: not a git repository (or any ';
export const GIT_SETTING_ARGUMENTS = ['config', '--null', '--get'] as const;
export const GIT_HOOKS_ARGUMENTS = ['rev-parse', '--git-path', 'hooks'] as const;
export const GIT_SHALLOW_ARGUMENTS = ['rev-parse', '--is-shallow-repository'] as const;
