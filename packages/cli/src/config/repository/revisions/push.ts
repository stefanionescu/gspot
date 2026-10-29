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
