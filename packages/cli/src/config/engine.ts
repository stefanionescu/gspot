import { STAGES } from '#cli/config/manifests.ts';
import type { CheckStatus } from '#cli/types/engine/run.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import type { CheckOutput } from '#cli/types/engine/tool-runs.ts';
import { PACKAGE_JSON, TSCONFIG_FILE, PYPROJECT_TOML } from '#cli/config/parsers.ts';

export const SHORT_HASH_LENGTH = 7;

export const BASE_FLAG = '--base';

export const FIX_ROUNDS = 3;

export const CONFLICT_MARKER_LINE = /^(?:<{7}|={7}|>{7})(?: |$)/mu;

export const FIX_CANCELED_MESSAGE = 'The fix was canceled.';

export const STAGED_FLAG = '--staged';

export const NO_FILES_MESSAGE = 'No matching files.';

export const DOCKER_MISSING_MESSAGE = 'Docker is not installed. Install Docker to run this check.';

export const CANCELED_CHECK_NOTE = 'The check was canceled.';

export const FAILED_STATUSES = new Set<CheckStatus>(['failed', 'error']);

export const CHECK_COMMAND = 'gspot check';

export const HOOK_FLAG = '--hook';

export const GIT_CHECK_IGNORE_ARGUMENTS = ['check-ignore', '--no-index', '-z', '--stdin'] as const;

export const FILES_BETWEEN_PAUSES = 64;

export const COPY_FOLDER_NAME = /^(?<pid>[1-9]\d{0,8})-[a-zA-Z0-9]+$/u;

export const COPY_IGNORE_FILE = '.gitignore';

export const COPY_IGNORE_TEXT = '*\n';

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

export const MISSING_PATH_CODES: ReadonlySet<string> = new Set(['ENOENT', 'ENOTDIR']);

export const FILE_GROUP = '(?<file>';

export const RULE_GROUP = '(?<rule>';

export const TAPLO_OUTPUTS = [
    {
        format: 'regex',
        pattern: String.raw`^\s*┌─ (?<file>(?:[A-Za-z]:)?[^:]+):(?<line>\d+):(?<column>\d+)$`,
        message: 'The file does not parse as TOML.',
    },
    {
        format: 'regex',
        pattern: '^(?:--- a/|ERROR taplo:format_files: the file is not properly formatted path=")(?<file>.+?)"?$',
        message: 'Not formatted the way Taplo formats it.',
        fixable: '^(?:--- a/|ERROR taplo:format_files)',
    },
] satisfies CheckOutput[];

export const JSON_START = /[[{]/u;

export const JSON_PREVIEW_LENGTH = 80;

export const PROCESS_KILLED_LINE = /^Command was killed with /u;

export const RAISE_TIMEOUT_MESSAGE = 'Raise the limit with gspot set tool_timeout_seconds <seconds>.';

export const NO_OUTPUT_MESSAGE = 'The command printed nothing; it should print a JSON report.';

export const INVALID_FINDING_MESSAGE = 'The JSON report contains an invalid finding object.';

export const EMPTY_FINDING_MESSAGE = 'The JSON report contains a finding without its mapped message.';

export const KNIP_ISSUE_MESSAGES = {
    binaries: 'Unlisted binary',
    catalog: 'Unused catalog entry',
    catalogReferences: 'Unresolved catalog reference',
    cycles: 'Circular dependency',
    dependencies: 'Unused dependency',
    devDependencies: 'Unused development dependency',
    duplicates: 'Duplicate export',
    enumMembers: 'Unused exported enum member',
    exports: 'Unused export',
    files: 'Unused file',
    namespaceMembers: 'Unused exported namespace member',
    nsExports: 'Export in used namespace',
    nsTypes: 'Exported type in used namespace',
    optionalPeerDependencies: 'Referenced optional peer dependency',
    types: 'Unused exported type',
    unlisted: 'Unlisted dependency',
    unresolved: 'Unresolved import',
} as const;

export const SEMGREP_PARSE_EXIT = 3;

export const SEMGREP_PARSE_ERRORS: ReadonlySet<string> = new Set(['ParseError', 'PartialParsing']);

export const SEMGREP_PARSE_RULE = 'parse-error';

export const LEADING_DOT_SLASH = /^\.\//u;

export const STAGE_FILTERS = [...STAGES, 'all'] as const;

export const REPORT_STAGES = {
    commit: ['commit'],
    push: ['push'],
    message: ['message'],
    manual: ['manual'],
    all: ['commit', 'push'],
} as const;

export const COVERAGE_DIMENSIONS = [
    'min_line_percent',
    'min_branch_percent',
    'min_function_percent',
    'min_statement_percent',
] as const;

export const ROOT_RUNS = ['once', 'history'] as const;

export const TYPOS_CODE_HELP = "Rename it with your editor's rename, and update its callers.";

export const IGNORED_PATHS_MESSAGE = 'every selected path is ignored in gspot.toml';

export const INCOMPLETE_STATUSES = new Set<CheckStatus>(['missing', 'error']);

export const RAN_STATUSES = new Set<CheckStatus>(['passed', 'failed']);

export const WINDOWS_ESCAPE_EXPANSION = 5;

export const WINDOWS_ARGUMENT_OVERHEAD = 9;

export const WINDOWS_COMMAND_LIMIT = 7000;

export const WINDOWS_PROCESS_LIMIT = 32_767;

export const WINDOWS_QUOTES_LENGTH = 3;

export const BATCH_FILE = /\.(?:bat|cmd)$/iu;

export const UNIX_COMMAND_LIMIT = 100_000;

export const TOOL_ARGUMENTS_MESSAGE = 'Tool arguments exceed the command limit. Shorten the tool arguments.';

export const OUT_OF_MEMORY = /JavaScript heap out of memory|Reached heap limit/u;

export const TAIL_LINES = 20;

export const NO_ERROR_OUTPUT_MESSAGE = 'The tool printed no error output.';

export const OUT_OF_MEMORY_MESSAGE =
    'The tool ran out of memory. It most likely read build output or a bundle: keep that folder in .gitignore, or add an [[ignore]] with its paths.';

export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;

export const WORKSPACE_PLACEHOLDER = /^\{workspace:(?<name>[^}]+)\}$/u;

export const CONFIG_PLACEHOLDER = /\{config_file:(?<name>[a-z0-9-]+)\}/gu;

export const LINK_FILE_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;

export const FORMATTER_CHECKS: ReadonlySet<string> = new Set([
    'format/prettier',
    'python/ruff-format',
    'swift/swiftformat',
    'bash/shfmt',
    'data-files/taplo',
    'sql/sqlfluff',
]);

export const COMMAND_PLACEHOLDER = /\{(?<name>[a-z_]+)(?::(?<value>[^{}]+))?\}/gu;

export const SETTING_ONLY_PLACEHOLDER = /^\{setting:(?<name>[a-z\d_.-]+)\}$/u;

export const FILES_PLACEHOLDER = /^\{files(?::prefix=(?<prefix>[^}]*))?\}$/u;

export const COPIES_FOLDER = '.gspot-copies';

export const JSCONFIG_FILE = 'jsconfig.json';

export const FILE_PLACEHOLDER = '{file}';

export const EXIT_FINDINGS = 1;

export const DOCKER_TOOL = 'docker';

export const LOCAL_RULES_SETTING = 'security.rule_files';

export const DOCKER_DAEMON_NOTE = 'Start Docker, then run the check again.';

export const BYTES_PER_KILOBYTE = 1024;

export const OFF_BY_LEVEL = 'off (level)';

export const NO_MATCHING_FILES = 'no matching files';

export const PROGRESS_CLEAR = '\r\u{1B}[2K';

export const STAGED_FILES = 'the staged files';

export const WORKING_TREE = 'the working tree';

export const EVERY_CHECK = 'every check';

export const BASELINE_EXEMPT_CHECK = /^(?:gspot|secrets)\//u;
