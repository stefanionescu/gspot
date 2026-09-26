// The literal values checks/secrets reads: names, patterns, limits, and tables.

export const GIT_TIMEOUT_MS = 30_000;
export const CHANGE_LINE =
    /^:[0-7]{6} (100644|100755|120000) (?:[a-f0-9]{40}|[a-f0-9]{64}) ([a-f0-9]{40}|[a-f0-9]{64}) [AMT]$/u;
export const DIFF_TREE = [
    'diff-tree',
    '--root',
    '--no-commit-id',
    '--raw',
    '-z',
    '--no-renames',
    '-r',
    '-m',
    '--diff-filter=AMT',
];
export const COMMIT_METADATA = ['show', '--no-patch', '--no-show-signature', '--format=%an%n%ae%n%cn%n%ce%n%B'];
