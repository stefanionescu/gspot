// The literal values repository/revisions reads: names, patterns, limits, and tables.

export const CHANGED_PATHS = ['diff', '--relative', '--name-only', '--no-renames', '-z'];
export const GIT_HASH = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
export const ABSENT_HASH = /^0+$/u;
export const DIFF_PATHS = ['diff', '--relative', '--no-ext-diff', '--name-only', '--no-renames', '-z'];
export const LOG_PATHS = [
    'log',
    '--relative',
    '--format=',
    '--name-only',
    '--no-renames',
    '--diff-merges=separate',
    '-z',
];
