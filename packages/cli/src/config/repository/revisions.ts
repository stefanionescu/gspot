export const GIT_REMOTE_HEADS_ARGUMENTS = ['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes'] as const;

export const HEAD_SUFFIX = '/HEAD';

export const GIT_HEAD_NAME_ARGUMENTS = ['rev-parse', '--symbolic-full-name', 'HEAD'] as const;

export const GIT_UPSTREAM_ARGUMENTS = ['for-each-ref', '--format=%(upstream)', '--'] as const;

export const ORIGIN_HEAD = 'refs/remotes/origin/HEAD';

export const GIT_MERGE_BASE_ARGUMENTS = ['merge-base', '--'] as const;

export const GIT_STAGED_DIFF_ARGUMENTS = [
    'diff',
    '--relative',
    '--cached',
    '--name-only',
    '--no-renames',
    '-z',
] as const;

export const GIT_CHANGED_COMMITS_ARGUMENTS = ['rev-list', '--reverse'] as const;

export const GIT_DIFF_NAMES_ARGUMENTS = ['diff', '--relative', '--name-only', '--no-renames', '-z'] as const;

export const GIT_SHALLOW_ARGUMENTS = ['rev-parse', '--is-shallow-repository'] as const;

export const REMOTE_HEAD_FIELD_COUNT = 2;

export const NO_UPSTREAM_MESSAGE =
    'No upstream or default branch is available. Run git remote set-head origin --auto once, or pass --changed <ref>.';

export const HISTORY_CUT_MESSAGE = ' History is cut; run git fetch --unshallow.';

export const GIT_LS_TREE_ARGUMENTS = ['ls-tree', '-r', '-z'] as const;

export const GIT_BLOBS_ARGUMENTS = ['cat-file', '--batch'] as const;

export const GIT_HEAD_ARGUMENTS = ['rev-parse', '--verify', '--quiet', 'HEAD'] as const;

export const GIT_SYMBOLIC_HEAD_ARGUMENTS = ['symbolic-ref', '--quiet', 'HEAD'] as const;

export const UNREADABLE_HISTORY_MESSAGE = 'Cannot read committed Git history. Restore HEAD and check again.';

export const ABSENT_HASH = /^0+$/u;

export const GIT_PEEL_ARGUMENTS = ['cat-file', '--batch-check=%(objectname) %(objecttype)'] as const;

export const PEEL_SUFFIX = '^{}';

export const GIT_SHALLOW_FILE_ARGUMENTS = ['rev-parse', '--git-path', 'shallow'] as const;

export const MISSING_PUSH_REVISION_MESSAGE = 'Cannot find pushed object {hash}. Fetch the remote again.';

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
