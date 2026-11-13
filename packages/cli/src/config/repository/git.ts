import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';

// changed revisions

export const COMMIT_SUFFIX = '^{commit}';
export const DEFAULT_BRANCHES = ['main', 'master'] as const;
export const GIT_CHANGED_COMMITS_ARGUMENTS = ['rev-list', '--reverse'] as const;
export const GIT_DIFF_NAMES_ARGUMENTS = ['diff', '--relative', '--name-only', '--no-renames', '-z'] as const;
export const GIT_HASH_EXISTS_ARGUMENTS = ['cat-file', '-e'] as const;
export const GIT_LOCAL_BRANCHES_ARGUMENTS = ['for-each-ref', '--format=%(refname:short)', 'refs/heads'] as const;
export const GIT_MERGE_BASE_ARGUMENTS = ['merge-base', '--'] as const;
export const GIT_NO_OPTIONAL_LOCKS = { GIT_OPTIONAL_LOCKS: '0' } as const;
export const GIT_REF_NAME_ARGUMENTS = ['rev-parse', '--symbolic-full-name', '--verify', '--quiet'] as const;
export const GIT_REMOTE_HEADS_ARGUMENTS = ['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes'] as const;
// Git opens a submodule only to find dirty content, which no check reads, and that step fails on a gitlink path that
// is a link. The recorded commit of a submodule still counts.
export const GIT_STATUS_ARGUMENTS = [
    'status',
    '--porcelain=v1',
    '-z',
    '--no-renames',
    '--untracked-files=all',
    '--ignore-submodules=dirty',
] as const;
export const GIT_UPSTREAM_ARGUMENTS = ['for-each-ref', '--format=%(upstream)', '--'] as const;
export const GIT_VERIFY_COMMIT_ARGUMENTS = ['rev-parse', '--verify', '--quiet', '--end-of-options'] as const;
export const ORIGIN_REMOTE = 'origin';
export const REMOTES_PREFIX = 'refs/remotes/';
export const REMOTE_HEAD = 'origin/HEAD';
export const REMOTE_HEAD_FIELD_COUNT = 2;
export const REMOTE_HEAD_HELP =
    ' A clone sets origin/HEAD, and git remote add does not, so run git remote set-head origin --auto. Before the first push to an empty remote, that command fails, so run gspot check --only push.';
export const SHALLOW_CLONE_HELP =
    ' This clone is shallow and lacks older commits. Fetch the full history with git fetch --unshallow, or set the fetch depth of the checkout to 0.';
export const STATUS_PATH_START = 3;
export const UNCHANGED_STATUS = ' ';
export const UNTRACKED_STATUS = '?';

// conflict markers
export const CONFLICT_END = /^>{7}(?: |$)/u;
export const CONFLICT_SEPARATOR = /^={7}(?: |$)/u;
export const CONFLICT_START = /^<{7}(?: |$)/u;

// push revisions
export const ABSENT_HASH = /^0+$/u;
export const BRANCHES_PREFIX = 'refs/heads/';
export const DELETED_REF_REASON = 'deleted ref';
export const FORCE_PUSH_MESSAGE =
    'Do not force-push {ref}: its remote tip {hash} is not an ancestor of the pushed commit. Merge the remote branch, then push.';
export const GIT_IS_ANCESTOR_ARGUMENTS = ['merge-base', '--is-ancestor'] as const;
export const GIT_LOG_ARGUMENTS = [
    'log',
    '--relative',
    '--format=',
    '--name-only',
    '--no-renames',
    '--diff-merges=separate',
    '-z',
] as const;
export const GIT_PEEL_ARGUMENTS = ['cat-file', '--batch-check=%(objectname) %(objecttype)'] as const;
export const GIT_REMOTE_ARGUMENTS = ['remote'] as const;
export const GIT_REV_LIST_ARGUMENTS = ['rev-list'] as const;
export const GIT_ROOT_COMMITS_ARGUMENTS = ['rev-list', '--max-parents=0'] as const;
export const GIT_TREE_ARGUMENTS = ['rev-parse', '--verify'] as const;
export const GIT_TREE_NAMES_ARGUMENTS = ['ls-tree', '--name-only'] as const;
const HASH_SOURCE = '(?:[a-f0-9]{40}|[a-f0-9]{64})';
export const HASH_PATTERN = new RegExp(`^${HASH_SOURCE}$`, 'iu');
export const INVALID_PUSH_INPUT_MESSAGE = 'Invalid Git pre-push input. Supply every local and remote ref/object pair.';
export const MISSING_PUSH_REVISION_MESSAGE = 'Cannot find the commit {hash} that the push sends.';
export const NON_COMMIT_REASON = 'non-commit object';
export const NOT_FLAG = '--not';
export const NO_CHANGES_REASON = 'no changed paths';
export const NO_SETTINGS_REASON = 'the commit has no gspot.toml';
export const PEEL_FAILURE_MESSAGE = 'Git did not resolve every pushed object.';
export const PEEL_SUFFIX = '^{}';
export const PUSH_SKIP_REASONS = [
    DELETED_REF_REASON,
    NON_COMMIT_REASON,
    NO_SETTINGS_REASON,
    NO_CHANGES_REASON,
] as const;
export const REMOTES_FLAG = '--remotes';
export const TREE_SUFFIX = '^{tree}';
export const UNFETCHED_PUSH_MESSAGE = 'The remote tip {hash} of {ref} is not in this clone. Fetch, then push.';

// git output
export const ANY_FOLDER_PREFIX = '**/';
export const ATTRIBUTE_ASSIGNMENT_SIDES = 2;
export const ATTRIBUTE_FIELDS = 3;
export const ATTRIBUTE_LINE = /^("(?:[^"\\]|\\.)*"|\S+)(?:\s+|$)/u;
export const BLOB_HEADER = new RegExp(String.raw`^(${HASH_SOURCE}) blob (\d+)$`, 'u');
export const FIRST_NON_PRINTABLE_BYTE = 127;
export const FIRST_PRINTABLE_BYTE = 32;
export const IGNORED_ATTRIBUTE_LINE = /^(?:#|\[attr\])/u;
export const IGNORED_ATTRIBUTE_PATTERN = /^!|\/$/u;
export const INDEX_LINE = new RegExp(
    String.raw`^(?<mode>\d{6}) (?<hash>${HASH_SOURCE}) (?<stage>[0-3])\t(?<path>[\s\S]+)$`,
    'u',
);
export const INVALID_GIT_STREAM_MESSAGE = 'The Git object stream is incomplete or invalid.';
export const LINE_FEED = 10;
export const OCTAL_BYTE_WIDTH = 3;
export const OCTAL_PATH_BYTE = /^\\[0-3][0-7]{2}$/u;
export const PATH_ESCAPES: Readonly<Record<string, string>> = {
    a: '\u{7}',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
    '\\': '\\',
    '"': '"',
};
export const QUOTED_ATTRIBUTE_PATTERN = /^"(?:[^"\\]|\\.)*"$/u;
export const QUOTED_PATH_CHUNKS = /\\(?:[0-3][0-7]{2}|[\s\S])|[^\\]+/gu;
export const SIZE_GROUP = 2;
export const TREE_LINE = new RegExp(
    String.raw`^(?<mode>\d{6}) (?:blob|commit) (?<hash>${HASH_SOURCE})\t(?<path>[\s\S]+)$`,
    'u',
);
export const UNSUPPORTED_GIT_FILE_MESSAGE =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

// git process
export const COPIES_FOLDER = '.gspot-copies';
export const GIT_COMMAND_CONFIGURATION: ReadonlySet<string> = new Set(['GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS']);
export const GIT_PROGRAM = 'git';
export const GIT_CREATION_COMMANDS = [
    [GIT_PROGRAM, 'clone'],
    [GIT_PROGRAM, 'init'],
] as const;
export const GIT_FLAG_ARGUMENTS = ['config', '--bool', '--get'] as const;
export const GIT_FOLDER_VARIABLE = 'GIT_DIR';
export const GIT_LOCALE = { LC_ALL: 'C' } as const;
export const GIT_LOCAL_VARIABLES_ARGUMENTS = ['rev-parse', '--local-env-vars'] as const;
export const GIT_NONLOCAL_ENVIRONMENT_NAME = /^GIT_(?:PAGER|CONFIG_(?:COUNT|PARAMETERS|KEY_\d+|VALUE_\d+))$/u;
export const GIT_WORK_TREE_VARIABLE = 'GIT_WORK_TREE';
export const GIT_PATH_VARIABLES = [
    GIT_FOLDER_VARIABLE,
    GIT_WORK_TREE_VARIABLE,
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_COMMON_DIR',
    'GIT_GRAFT_FILE',
    'GIT_SHALLOW_FILE',
    'GIT_CONFIG',
] as const;
export const GIT_SETTING_ARGUMENTS = ['config', '--null', '--get'] as const;
export const GIT_TOP_LEVEL_ARGUMENTS = ['rev-parse', '--show-toplevel'] as const;
export const GIT_VARIABLE_PREFIX = 'GIT_';
export const NOT_REPOSITORY_CODE = 128;
export const NOT_REPOSITORY_MESSAGE = 'fatal: not a git repository (or any ';
export const SPARSE_CHECKOUT_MESSAGE = 'gspot does not support sparse checkouts. Run git sparse-checkout disable.';
export const SPARSE_CHECKOUT_SETTING = 'core.sparseCheckout';
export const TRAILING_NEWLINE = /\n$/u;

// revision copies
export const GIT_CHECK_IGNORE_ARGUMENTS = ['check-ignore', '--no-index', '-z', '--stdin'] as const;
export const GIT_PATH_ARGUMENTS = ['rev-parse', '--path-format=absolute', '--git-path'] as const;

// revision files
export const CRLF_INDEX_LINE = /^i\/(?:crlf|mixed)\s/u;
export const GIT_BLOBS_ARGUMENTS = ['cat-file', '--batch'] as const;
const NAME_ONLY_FLAG = '--name-only';
export const GIT_CHANGED_PATHS_ARGUMENTS = ['diff', NAME_ONLY_FLAG, '-z', 'HEAD', '--'] as const;
export const GIT_COMMITTED_PATHS_ARGUMENTS = ['ls-files', '-z', '--'] as const;
export const GIT_HEAD_ARGUMENTS = ['rev-parse', '--verify', '--quiet', 'HEAD'] as const;
export const GIT_LINE_ENDINGS_ARGUMENTS = ['ls-files', '--eol', '-z'] as const;
export const GIT_LS_TREE_ARGUMENTS = ['ls-tree', '-r', '-z'] as const;
export const GIT_SETUP_FILES_ARGUMENTS = ['ls-files', '--cached', '-z', '--', SETTINGS_FILE, GSPOT_FOLDER] as const;
export const GIT_SHALLOW_ARGUMENTS = ['rev-parse', '--is-shallow-repository'] as const;
export const GIT_SYMBOLIC_HEAD_ARGUMENTS = ['symbolic-ref', '--quiet', 'HEAD'] as const;
export const GIT_WRITE_TREE_ARGUMENTS = ['write-tree'] as const;
export const PRIVATE_INDEX_FILE = 'index';
export const READ_COMMITTED_MESSAGE =
    'Cannot read your committed tool configs. Run git status, then commit or stash the change.';
export const SETUP_PATHS = [SETTINGS_FILE, `${GSPOT_FOLDER}/`] as const;
export const UNREADABLE_HISTORY_MESSAGE =
    'Cannot read committed Git history. Run git status, then commit or stash the change.';
