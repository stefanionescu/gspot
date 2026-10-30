export const CLI_PACKAGE_JSON = '@gspothq/cli/package.json';

export const ALL_FILES_GLOB = '**/*';

export const OPERATING_SYSTEMS = [
    { nodeName: 'darwin', name: 'macos', label: 'macOS' },
    { nodeName: 'linux', name: 'linux', label: 'Linux' },
    { nodeName: 'win32', name: 'windows', label: 'Windows' },
] as const;

export const CACHE_FOLDER_NAME = 'gspot';

export const CACHE_FOLDER_MESSAGE =
    'The cache folder must be an absolute path. Set XDG_CACHE_HOME or LOCALAPPDATA to an absolute path.';

export const WRITE_FAILURE_CODES = ['EACCES', 'EPERM', 'EROFS'] as const;

export const TRAILING_NEWLINE = /\n$/u;

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

export const GIT_COMMAND_CONFIGURATION: ReadonlySet<string> = new Set(['GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS']);

export const GIT_CLONE_COMMAND = 'clone';

export const GIT_PROGRAM = 'git';

export const NOT_REPOSITORY_CODE = 128;

export const GIT_NONLOCAL_ENVIRONMENT_NAME = /^GIT_(?:PAGER|CONFIG_(?:COUNT|PARAMETERS|KEY_\d+|VALUE_\d+))$/u;

export const GIT_WORK_TREE_ARGUMENTS = ['rev-parse', '--is-inside-work-tree'] as const;

export const GIT_LOCALE = { LC_ALL: 'C' } as const;

export const GIT_DIR_VARIABLE = 'GIT_DIR';

export const GIT_LOCAL_VARIABLES_ARGUMENTS = ['rev-parse', '--local-env-vars'] as const;

export const GIT_SOURCE_ARGUMENTS = ['rev-parse', '--is-bare-repository', '--absolute-git-dir'] as const;

export const GIT_TOP_LEVEL_ARGUMENTS = ['rev-parse', '--show-toplevel'] as const;

export const GIT_FOLDER_ARGUMENTS = ['rev-parse', '--absolute-git-dir'] as const;

export const GIT_WORK_TREE_VARIABLE = 'GIT_WORK_TREE';

export const GIT_VARIABLE_PREFIX = 'GIT_';

export const NOT_REPOSITORY_MESSAGE = 'fatal: not a git repository (or any ';

export const GIT_SETTING_ARGUMENTS = ['config', '--null', '--get'] as const;

export const GIT_HOOKS_ARGUMENTS = ['rev-parse', '--git-path', 'hooks'] as const;

export const EXECUTABLE_LAYOUTS = {
    windows: {
        executableSuffixes: ['.cmd', '.exe', ''],
        environmentFolder: 'Scripts',
        environmentSuffix: '.exe',
    },
    posix: {
        executableSuffixes: [''],
        environmentFolder: 'bin',
        environmentSuffix: '',
    },
} as const;

export const DECLARATION_EXTENSIONS: readonly string[] = ['.d.ts', '.d.mts', '.d.cts'];

export const EXIT_CLEANUP_MILLISECONDS = 10;

export const OUTPUT_CLOSE_MILLISECONDS = 5000;

export const TASKKILL_GONE_CODE = 128;

export const FAILED_CODE = 1;

export const MISSING_CODE = 127;

export const PATHEXT_DEFAULT = '.COM;.EXE;.BAT;.CMD';

export const PATH_SEPARATORS = /[\\/]/u;

export const TASKKILL_PROGRAM = 'taskkill';

export const TASKKILL_FLAGS = ['/T', '/F'] as const;

export const TASKKILL_PID_FLAG = '/pid';

export const PROCESS_CLEANUP_MESSAGE = 'Tool execution and process cleanup failed.';

export const CANCELED_START_MESSAGE = 'The command was canceled before it started.';

export const EMPTY_COMMAND_MESSAGE = 'An empty command cannot run.';

export const OUTPUT_LIMIT = 256 * 1024 * 1024;

export const RUNTIME_NAMES = { node: 'Node.js', bun: 'Bun' } as const;

export const RESULT_JSON_INDENT = 2;

export const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const;

export const TERMINAL_CONTROL_CHARACTERS = /[^\P{Cc}\t\n]|\p{Cf}/gu;

export const TERMINAL_COLOR_SEQUENCE = new RegExp(
    String.raw`(${String.fromCodePoint(0x1b)}\[(?:2|22|3[1236]|39)m)`,
    'u',
);

export const TYPO_MIN = 1;

export const TYPO_FRACTION = 3;

export const SIMILAR_NAME_LIMIT = 3;

export const LIST_LIMIT = 8;

export const UNQUOTED_ARGUMENT = /^[\w@:./-]+$/u;
