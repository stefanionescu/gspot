// The literal values repository/revisions reads: names, patterns, limits, and tables.

export const WORKTREE_DIFF_ARGV = ['diff', '--relative', '--name-only', '--no-renames', '-z'];
export const HASH_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
export const ABSENT_HASH = /^0+$/u;
export const COMMIT_DIFF_ARGV = ['diff', '--relative', '--no-ext-diff', '--name-only', '--no-renames', '-z'];
export const LOG_ARGV = [
    'log',
    '--relative',
    '--format=',
    '--name-only',
    '--no-renames',
    '--diff-merges=separate',
    '-z',
];
