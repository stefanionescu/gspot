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
