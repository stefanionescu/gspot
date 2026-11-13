import { GSPOT_PATHS, STAGES } from '#cli/config/manifests.ts';
import { PACKAGE_JSON, PYPROJECT_TOML, TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import { SETTING_PLACEHOLDER, SETTINGS_FILE } from '#cli/config/repository/files.ts';
import type { CheckStatus } from '#cli/types/engine/run.ts';
import type { CheckOutput } from '#cli/types/manifests.ts';

// check flags
export const BASE_FLAG = '--base';
export const FIX_FLAG = '--fix';
export const HOOK_FLAG = '--hook';
export const ONLY_FLAG = '--only';
export const STAGED_FLAG = '--staged';

// check states
export const CHECK_STATUSES = ['passed', 'failed', 'missing', 'skipped', 'error', 'canceled'] as const;
export const COMPARED_CONTENTS = ['working-tree', 'index', 'commit'] as const;
export const FAILED_STATUSES = new Set<CheckStatus>(['failed', 'error']);
export const INCOMPLETE_STATUSES = new Set<CheckStatus>(['missing', 'error', 'canceled']);
export const RAN_STATUSES = new Set<CheckStatus>(['passed', 'failed']);
export const SKIP_CAUSES = ['level', 'system', 'replaced', 'setting', 'condition', 'ignore'] as const;
export const REPORTED_SKIP_CAUSES = [...SKIP_CAUSES, 'no-files'] as const;
export const STAGE_FILTERS = [...STAGES, 'all'] as const;

// command batches
export const BATCH_FILE = /\.(?:bat|cmd)$/iu;
export const TOOL_ARGUMENTS_MESSAGE = 'Tool arguments exceed the command limit. Shorten the tool arguments.';
export const UNIX_COMMAND_LIMIT = 100_000;
export const WINDOWS_ARGUMENT_OVERHEAD = 9;
export const WINDOWS_COMMAND_LIMIT = 7000;
export const WINDOWS_ESCAPE_EXPANSION = 5;
export const WINDOWS_PROCESS_LIMIT = 32_767;
export const WINDOWS_QUOTES_LENGTH = 3;

// copies
export const COPY_FOLDER_NAME = /^(?<pid>[1-9]\d{0,8})-[a-zA-Z0-9]+$/u;
export const COPY_IGNORE_TEXT = '*\n';
export const COPY_ROOT_FILES = [SETTINGS_FILE, PACKAGE_JSON, TSCONFIG_FILE, PYPROJECT_TOML] as const;
export const DECLARATION_CONFIG_EXTENSIONS = new Set(['.json', '.jsonc']);
export const DEPENDENCY_FILES: ReadonlySet<string> = new Set([PACKAGE_JSON, PYPROJECT_TOML]);
export const DEPENDENCY_REVISION_NOTE =
    'The dependency files in the working tree differ from the checked revision; the checks used the installed dependencies.';
export const FILES_BETWEEN_PAUSES = 64;
export const GIT_ALTERNATES_PATH = '.git/objects/info/alternates';
export const GIT_CHECKOUT_ARGUMENTS = ['checkout-index', '--all', '--force'] as const;
export const GIT_EMPTY_INDEX_ARGUMENTS = ['read-tree', '--empty'] as const;
export const GIT_HASH_ARGUMENTS = ['hash-object', '--stdin-paths'] as const;
export const GIT_HASH_FORMAT_ARGUMENTS = ['rev-parse', '--show-object-format'] as const;
export const GIT_INIT_ARGUMENTS = ['init', '--quiet'] as const;
export const GIT_RAW_ATTRIBUTES_PATH = '.git/info/attributes';
export const GIT_SET_HEAD_ARGUMENTS = ['update-ref', '--no-deref', 'HEAD'] as const;
export const GIT_SHALLOW_PATH = '.git/shallow';
export const GIT_UPDATE_INDEX_ARGUMENTS = ['update-index', '-z', '--index-info'] as const;
// Git writes the bytes of each blob, with no line-ending conversion and no filter such as LFS.
export const RAW_BLOB_ATTRIBUTES = '* -text -filter -ident -working-tree-encoding\n';

// fixes
export const FIX_CANCELED_MESSAGE = 'The fix was canceled.';
export const FIX_ROUNDS = 3;

// placeholders
export const COMMAND_PLACEHOLDER = /\{(?<name>[a-z_]+)(?::(?<value>[^{}]+))?\}/gu;
export const CONFIG_PLACEHOLDER = /\{config_file:(?<name>[a-z0-9-]+)\}/gu;
export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;
export const FILES_PLACEHOLDER = /^\{files(?::prefix=(?<prefix>[^}]*))?\}$/u;
export const FILE_PLACEHOLDER = '{file}';
export const FORMATTER_CHECKS: ReadonlySet<string> = new Set([
    'format/prettier',
    'python/ruff-format',
    'swift/swiftformat',
    'bash/shfmt',
    'toml/taplo',
    'sql/sqlfluff',
]);
export const POINTER_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;
export const SETTING_ONLY_PLACEHOLDER = new RegExp(`^${SETTING_PLACEHOLDER.source}$`, 'u');
export const WORKSPACE_PLACEHOLDER = /^\{workspace:(?<name>[^}]+)\}$/u;

// planned files
export const CONFIG_BOUND_RUNNERS = new Set(['vitest', 'jest']);
export const COVERAGE_DIMENSIONS = [
    'min_line_percent',
    'min_branch_percent',
    'min_function_percent',
    'min_statement_percent',
] as const;
export const IGNORED_PATHS_MESSAGE = 'every selected path is ignored in gspot.toml';
export const LOCAL_RULES_SETTING = 'security.semgrep_rules';
export const LOCAL_RULE_EXTENSION = '.yml';
export const ROOT_RUNS = ['once', 'history'] as const;

// run notes
export const GSPOT_CHECK_PREFIX = 'gspot/';
export const MISSING_GENERATED_FILE_MESSAGE = 'The generated file <path> is missing. Run gspot install.';

// run report
export const NO_FILES_MESSAGE = 'No matching files.';
export const PROGRESS_INTERVAL_MILLISECONDS = 10_000;
export const REPORT_STAGES = {
    commit: ['commit'],
    push: ['push'],
    message: ['message'],
    manual: ['manual'],
    all: ['commit', 'push'],
} as const;
export const RUNNING_CHECKS_SHOWN = 3;
export const SHORT_HASH_LENGTH = 7;
export const STAGED_FILES = 'the staged files';
export const WORKING_TREE = 'the working tree';

// tool failures
export const BROKEN_TOOL_ADVICE = `A tool in ${GSPOT_PATHS.nodeModules} failed to load. Run gspot install.`;
// Node prints one of these when a module fails to resolve or parse, before the tool runs.
export const MODULE_FAILURE =
    /\b(?:ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|ERR_REQUIRE_ESM|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_UNSUPPORTED_DIR_IMPORT|ERR_INVALID_PACKAGE_CONFIG)\b|Cannot find (?:module|package)|does not provide an export named|^SyntaxError: /mu;
export const NO_ERROR_OUTPUT_MESSAGE = 'The tool printed no error output.';
export const OUT_OF_MEMORY = /JavaScript heap out of memory|Reached heap limit/u;
export const OUT_OF_MEMORY_MESSAGE =
    'The tool ran out of memory. It most likely read build output or a bundle: keep that folder in .gitignore, or add an [[ignore]] with its paths.';
export const PROCESS_KILLED_LINE = /^Command was killed with /u;
export const RAISE_TIMEOUT_MESSAGE = 'Raise the limit with gspot set tool_timeout_seconds <seconds>.';
export const TAIL_LINES = 20;

// tool output formats
export const EMPTY_FINDING_MESSAGE = 'The JSON report contains a finding without its mapped message.';
export const FILE_GROUP = '(?<file>';
export const FILE_LINK = /^file:\/\/\/[^\s#?]+/u;
export const INVALID_FINDING_MESSAGE = 'The JSON report contains an invalid finding object.';
export const JSON_PREVIEW_LENGTH = 80;
export const JSON_START = /[[{]/u;
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
export const LEADING_DOT_SLASH = /^\.\//u;
export const MISSING_RULE_HELP = 'This comment names a rule of a plugin that gspot does not run. Delete the comment.';
export const MISSING_RULE_MESSAGE = /^Definition for rule '.+' was not found\.$/u;
export const NO_OUTPUT_MESSAGE = 'The command printed nothing; it should print a JSON report.';
export const RULE_GROUP = '(?<rule>';
export const SEMGREP_PARSE_ERRORS: ReadonlySet<string> = new Set(['ParseError', 'PartialParsing']);
export const SEMGREP_PARSE_EXIT = 3;
export const SEMGREP_PARSE_RULE = 'parse-error';
// Semgrep warns when a line holds a nosemgrep comment for one rule and a match of another rule, which it still reports.
export const SEMGREP_UNMATCHED_SUPPRESSION =
    /found 'nosem' comment with id '[^']+', but no corresponding rule trying '[^']+'/u;
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
export const UNSAFE_FIXES: ReadonlySet<unknown> = new Set(['unsafe', 'display-only']);
