import { EXECUTABLE_FILE, PERMISSION_BITS, OWNER_WRITABLE_FILE } from '#cli/config/platform/root.ts';

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

export const WORKTREE_DIFF_ARGV = ['diff', '--relative', '--name-only', '--no-renames', '-z'];

export const GITLINK_MODE = '160000';
export const SYMLINK_MODE = '120000';

export const ENTRY_MODES = {
    '100644': OWNER_WRITABLE_FILE,
    '100755': EXECUTABLE_FILE,
    [SYMLINK_MODE]: PERMISSION_BITS,
};

export const REFSPEC_FIELDS = 2;
