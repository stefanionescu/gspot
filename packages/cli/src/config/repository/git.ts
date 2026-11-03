const HASH_SOURCE = '(?:[a-f0-9]{40}|[a-f0-9]{64})';

export const HASH_PATTERN = new RegExp(`^${HASH_SOURCE}$`, 'u');

export const UNSUPPORTED_GIT_FILE_MESSAGE =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

export const BLOB_HEADER = new RegExp(String.raw`^(${HASH_SOURCE}) blob (\d+)$`, 'u');

export const INDEX_LINE = new RegExp(
    String.raw`^(?<mode>\d{6}) (?<hash>${HASH_SOURCE}) (?<stage>[0-3])\t(?<path>[\s\S]+)$`,
    'u',
);

export const TREE_LINE = new RegExp(
    String.raw`^(?<mode>\d{6}) (?:blob|commit) (?<hash>${HASH_SOURCE})\t(?<path>[\s\S]+)$`,
    'u',
);

export const ATTRIBUTE_FIELDS = 3;

export const ATTRIBUTE_ASSIGNMENT_SIDES = 2;

export const ATTRIBUTE_LINE = /^("(?:[^"\\]|\\.)*"|\S+)(?:\s+|$)/u;

export const IGNORED_ATTRIBUTE_LINE = /^(?:#|\[attr\])/u;

export const IGNORED_ATTRIBUTE_PATTERN = /^!|\/$/u;

export const QUOTED_ATTRIBUTE_PATTERN = /^"(?:[^"\\]|\\.)*"$/u;

export const QUOTED_PATH_CHUNKS = /\\(?:[0-3][0-7]{2}|[\s\S])|[^\\]+/gu;

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

export const INVALID_GIT_STREAM_MESSAGE = 'The Git object stream is incomplete or invalid.';

export const ANY_FOLDER_PREFIX = '**/';

export const SIZE_GROUP = 2;

export const FIRST_PRINTABLE_BYTE = 32;

export const FIRST_NON_PRINTABLE_BYTE = 127;

export const OCTAL_BYTE_WIDTH = 3;

export const GIT_REMOTE_HEADS_ARGUMENTS = ['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes'] as const;

export const GIT_HEAD_NAME_ARGUMENTS = ['rev-parse', '--symbolic-full-name', 'HEAD'] as const;

export const GIT_UPSTREAM_ARGUMENTS = ['for-each-ref', '--format=%(upstream)', '--'] as const;

export const ORIGIN_REMOTE = 'origin';

export const REMOTES_PREFIX = 'refs/remotes/';

export const BRANCHES_PREFIX = 'refs/heads/';

export const DEFAULT_BRANCHES = ['main', 'master'] as const;

export const GIT_IS_ANCESTOR_ARGUMENTS = ['merge-base', '--is-ancestor'] as const;

export const FORCE_PUSH_MESSAGE =
    'Do not force-push {ref}: its remote tip {hash} is not an ancestor of the pushed commit. Merge the remote branch, then push.';

export const UNFETCHED_PUSH_MESSAGE = 'The remote tip {hash} of {ref} is not in this clone. Fetch, then push.';

export const GIT_MERGE_BASE_ARGUMENTS = ['merge-base', '--'] as const;

export const GIT_CHANGED_COMMITS_ARGUMENTS = ['rev-list', '--reverse'] as const;

export const GIT_DIFF_NAMES_ARGUMENTS = ['diff', '--relative', '--name-only', '--no-renames', '-z'] as const;

export const GIT_SHALLOW_ARGUMENTS = ['rev-parse', '--is-shallow-repository'] as const;

export const GIT_WRITE_TREE_ARGUMENTS = ['write-tree'] as const;

export const REMOTE_HEAD_FIELD_COUNT = 2;

export const GIT_LS_TREE_ARGUMENTS = ['ls-tree', '-r', '-z'] as const;

export const GIT_BLOBS_ARGUMENTS = ['cat-file', '--batch'] as const;

export const GIT_HEAD_ARGUMENTS = ['rev-parse', '--verify', '--quiet', 'HEAD'] as const;

export const GIT_SYMBOLIC_HEAD_ARGUMENTS = ['symbolic-ref', '--quiet', 'HEAD'] as const;

export const UNREADABLE_HISTORY_MESSAGE =
    'Cannot read committed Git history. Run git status, then commit or stash the change.';

export const ABSENT_HASH = /^0+$/u;

export const GIT_PEEL_ARGUMENTS = ['cat-file', '--batch-check=%(objectname) %(objecttype)'] as const;

export const PEEL_SUFFIX = '^{}';

export const GIT_SHALLOW_FILE_ARGUMENTS = ['rev-parse', '--git-path', 'shallow'] as const;

export const MISSING_PUSH_REVISION_MESSAGE = 'Cannot find the commit {hash} that the push sends.';

export const REMOTES_FLAG = '--remotes';

export const GIT_LOG_ARGUMENTS = [
    'log',
    '--relative',
    '--format=',
    '--name-only',
    '--no-renames',
    '--diff-merges=separate',
    '-z',
] as const;

export const GIT_REV_LIST_ARGUMENTS = ['rev-list'] as const;

export const GIT_TREE_ARGUMENTS = ['rev-parse', '--verify'] as const;

export const TREE_SUFFIX = '^{tree}';

export const GIT_ROOT_COMMITS_ARGUMENTS = ['rev-list', '--max-parents=0', 'HEAD'] as const;

export const GIT_REMOTE_ARGUMENTS = ['remote'] as const;

export const DELETED_REF_REASON = 'deleted ref';

export const NON_COMMIT_REASON = 'non-commit object';

export const INVALID_PUSH_INPUT_MESSAGE = 'Invalid Git pre-push input. Supply every local and remote ref/object pair.';

export const PEEL_FAILURE_MESSAGE = 'Git did not resolve every pushed object.';

export const NOT_FLAG = '--not';

export const EMPTY_BASE_HASH = /^0*$/u;

export const COMMIT_HASH_PATTERN = /^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/u;

export const GIT_VERIFY_COMMIT_ARGUMENTS = ['rev-parse', '--verify', '--quiet', '--end-of-options'] as const;

export const COMMIT_SUFFIX = '^{commit}';

export const GIT_LOCAL_BRANCHES_ARGUMENTS = ['for-each-ref', '--format=%(refname:short)', 'refs/heads'] as const;

export const GIT_HASH_EXISTS_ARGUMENTS = ['cat-file', '-e'] as const;

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

export const GIT_PROGRAM = 'git';

export const GIT_CREATION_COMMANDS = [
    [GIT_PROGRAM, 'clone'],
    [GIT_PROGRAM, 'init'],
] as const;

export const NOT_REPOSITORY_CODE = 128;

export const GIT_NONLOCAL_ENVIRONMENT_NAME = /^GIT_(?:PAGER|CONFIG_(?:COUNT|PARAMETERS|KEY_\d+|VALUE_\d+))$/u;

export const GIT_LOCALE = { LC_ALL: 'C' } as const;

export const GIT_FOLDER_VARIABLE = 'GIT_DIR';

export const GIT_LOCAL_VARIABLES_ARGUMENTS = ['rev-parse', '--local-env-vars'] as const;

export const GIT_TOP_LEVEL_ARGUMENTS = ['rev-parse', '--show-toplevel'] as const;

export const COPIES_FOLDER = '.gspot-copies';

export const GIT_WORK_TREE_VARIABLE = 'GIT_WORK_TREE';

export const GIT_VARIABLE_PREFIX = 'GIT_';

export const NOT_REPOSITORY_MESSAGE = 'fatal: not a git repository (or any ';

export const GIT_SETTING_ARGUMENTS = ['config', '--null', '--get'] as const;

export const GIT_HOOKS_ARGUMENTS = ['rev-parse', '--git-path', 'hooks'] as const;

export const LINE_FEED = 10;
