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
