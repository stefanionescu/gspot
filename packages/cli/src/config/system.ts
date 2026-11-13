// file modes

export const EXECUTABLE_BITS = 0o111;
export const EXECUTABLE_FILE = 0o755;
export const MODE_BITS = 0o7777;
export const OWNER_WRITABLE_FILE = 0o644;
export const OWNER_WRITE_BIT = 0o200;
export const PERMISSION_BITS = 0o777;
export const PRIVATE_FILE = 0o600;
export const PRIVATE_FOLDER = 0o700;
export const READ_ONLY_FILE = 0o444;
export const WRITABLE_FILE = 0o666;
export const WRITE_FAILURE_CODES = ['EACCES', 'EPERM', 'EROFS'] as const;

// folder names
export const GIT_METADATA_NAME = '.git';
export const GSPOT_FOLDER = '.gspot';
export const NODE_MODULES = 'node_modules';
export const PYTHON_ENVIRONMENT_FOLDER = '.venv';
export const INSTALLED_DEPENDENCY_FOLDERS: ReadonlySet<string> = new Set([
    NODE_MODULES,
    'bower_components',
    PYTHON_ENVIRONMENT_FOLDER,
    'venv',
    'Pods',
    'DerivedData',
    '.build',
]);

// globs
export const FOLDER_CONTENTS = '/**';
export const GLOB_EXCLUDE = '!';
export const GLOB_EXCLUSION = /^!(?!\()/u;
export const GLOB_SPECIAL_CHARACTERS = /[\\*?{}[\]()!+@,]/gu;

// host and cache
export const CACHE_FOLDER_MESSAGE =
    'The cache folder must be an absolute path. Set XDG_CACHE_HOME or LOCALAPPDATA to an absolute path.';
export const CACHE_FOLDER_NAME = 'gspot';
export const CLI_PACKAGE_JSON = '@gspothq/cli/package.json';
export const OPERATING_SYSTEMS = [
    { nodeName: 'darwin', name: 'macos', label: 'macOS' },
    { nodeName: 'linux', name: 'linux', label: 'Linux' },
    { nodeName: 'win32', name: 'windows', label: 'Windows' },
] as const;

// paths
export const DECLARATION_EXTENSIONS: readonly string[] = ['.d.ts', '.d.mts', '.d.cts'];
export const DRIVE_LETTER = /^[a-z]:/iu;
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
export const LEADING_SLASH = /^\//u;
export const LINK_REFUSAL = 'is a link. gspot does not write through links.';
export const MISSING_TRACKED_FILE_MESSAGE = '{path} is tracked but missing. Restore it or commit its deletion.';
export const PATH_SEPARATORS = /[\\/]/u;
export const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..']);
export const TRAILING_SLASH = /\/$/u;
export const UNSAFE_PATH_MESSAGE =
    '{path} is not a safe repository-relative path. Choose a path inside the repository.';

// units
export const BYTES_PER_KILOBYTE = 1024;
export const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE;
export const MILLISECONDS_PER_SECOND = 1000;
export const MINUTES_PER_DAY = 1440;
const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_DAY = MINUTES_PER_DAY * SECONDS_PER_MINUTE;
export const MILLISECONDS_PER_DAY = SECONDS_PER_DAY * MILLISECONDS_PER_SECOND;

// processes
export const CANCELED_START_MESSAGE = 'The command was canceled before it started.';
export const EMPTY_COMMAND_MESSAGE = 'An empty command cannot run.';
export const EXIT_CLEANUP_MILLISECONDS = 10;
export const FAILED_CODE = 1;
export const MISSING_CODE = 127;
export const OUTPUT_CLOSE_MILLISECONDS = 5000;
export const OUTPUT_LIMIT = 256 * BYTES_PER_MEGABYTE;
export const OUTPUT_POLL_MILLISECONDS = 1000;
export const OUTSIDE_PROGRAMS: ReadonlySet<string> = new Set(['git', 'mise', 'node', 'npm', 'uv']);
export const OVER_LIMIT_COMPLETION = {
    failed: true,
    code: 'ERR_OUTPUT_LIMIT',
    stdout: '',
    stderr: 'The command wrote more output than gspot reads from one command.',
} as const;
export const PATHEXT_DEFAULT = '.COM;.EXE;.BAT;.CMD';
export const PROCESS_CLEANUP_MESSAGE = 'Tool execution and process cleanup failed.';
export const PYTHON_EXECUTABLE = 'python';
export const STOP_GRACE_MILLISECONDS = 3000;
export const STOP_POLL_MILLISECONDS = 20;
export const TASKKILL_FLAGS = ['/T', '/F'] as const;
export const TASKKILL_GONE_CODE = 128;
export const TASKKILL_PID_FLAG = '/pid';
export const TASKKILL_PROGRAM = 'taskkill';
export const UNSTARTED_COMPLETION = { failed: true, stdout: '', stderr: '' } as const;
export const UNSTOPPED = { timedOut: false, canceled: false } as const;

// temporary files
export const PARENT_SEGMENT = /(?:^|[/{,])\.\.(?=[/},]|$)/u;
export const TEMPORARY_FILE_PREFIX = '.gspot-';
export const TEMPORARY_FILE_SUFFIX = '.tmp';
export const TEMPORARY_REMOVAL_OPTIONS = { recursive: true, force: true, maxRetries: 5, retryDelay: 100 } as const;
export const TEMPORARY_STALE_MILLISECONDS = 1 * MILLISECONDS_PER_DAY;

// terminal and exit codes
export const EXIT_ERROR = 2;
export const EXIT_FINDINGS = 1;
export const PROGRESS_CLEAR = '\r\u{1B}[2K';
export const RESULT_JSON_INDENT = 2;
export const SIGNAL_EXIT_CODES = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 } as const;
const ESCAPE_CODE_POINT = 0x1b;
export const TERMINAL_COLOR_SEQUENCE = new RegExp(
    String.raw`(${String.fromCodePoint(ESCAPE_CODE_POINT)}\[(?:2|22|3[1236]|39)m)`,
    'u',
);
export const TERMINAL_CONTROL_CHARACTERS = /[^\P{Cc}\t\n]|\p{Cf}/gu;

// text
export const CONFLICT_END = /^>{7}(?: |$)/u;
export const CONFLICT_SEPARATOR = /^={7}(?: |$)/u;
export const CONFLICT_START = /^<{7}(?: |$)/u;
export const DIGIT_BOUNDARY = /(?<=\D)(?=\d)|(?<=\d)(?=\D)/u;
export const HEXADECIMAL_RADIX = 16;
export const LINE_BREAK = /\r?\n/u;
export const LIST_LIMIT = 8;
export const NOT_LINE_BREAK = /[^\r\n]/gu;
export const NUMERIC_WORDS = new Set([
    'base64',
    'utf8',
    'utf16',
    'sha1',
    'sha256',
    'sha512',
    'md5',
    'oauth2',
    'http2',
    'http3',
    'ipv4',
    'ipv6',
    's3',
    'k8s',
    'e2e',
    'i18n',
    'l10n',
    'a11y',
    'int8',
    'int16',
    'int32',
    'int64',
    'uint8',
    'uint16',
    'uint32',
    'uint64',
    'float32',
    'float64',
]);
export const OCTAL_RADIX = 8;
export const REGEXP_SYNTAX_CHARACTERS = /[$()*+.?[\\\]^{|}]/gu;
export const ROOT_SCOPE_MARK = '.';
export const SIMILAR_NAME_LIMIT = 3;
export const TYPO_FRACTION = 3;
export const TYPO_MIN = 1;
export const UNQUOTED_ARGUMENT = /^[\w@:./-]+$/u;
export const WHITESPACE_RUN = /\s+/gu;
export const WORD_SEPARATORS = /[^A-Za-z0-9]+/u;
