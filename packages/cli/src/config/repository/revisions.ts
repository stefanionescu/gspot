import { EXECUTABLE_FILE, PERMISSION_BITS, OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';

export const ABSENT_HASH = /^0+$/u;

export const COMMIT_DIFF_ARGV = ['diff', '--relative', '--name-only', '--no-renames', '-z'] as const;

export const LOG_ARGV = [
    'log',
    '--relative',
    '--format=',
    '--name-only',
    '--no-renames',
    '--diff-merges=separate',
    '-z',
] as const;

export const WORKTREE_DIFF_ARGV = ['diff', '--relative', '--name-only', '--no-renames', '-z'] as const;

export const GITLINK_MODE = '160000';
export const SYMLINK_MODE = '120000';

export const ENTRY_MODES = {
    '100644': OWNER_WRITABLE_FILE,
    '100755': EXECUTABLE_FILE,
    [SYMLINK_MODE]: PERMISSION_BITS,
} as const;

export const REMOTE_HEADS_ARGV = ['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes'] as const;
export const HEAD_SUFFIX = '/HEAD';
export const HEAD_NAME_ARGV = ['rev-parse', '--symbolic-full-name', 'HEAD'] as const;
export const UPSTREAM_ARGV = ['for-each-ref', '--format=%(upstream)', '--'] as const;
export const ORIGIN_HEAD = 'refs/remotes/origin/HEAD';
export const MERGE_BASE_ARGV = ['merge-base', '--'] as const;
export const STAGED_DIFF_ARGV = ['diff', '--relative', '--cached', '--name-only', '--no-renames', '-z'] as const;
export const CHANGED_COMMITS_ARGV = ['rev-list', '--reverse'] as const;
export const ROOT_COMMITS_ARGV = ['rev-list', '--max-parents=0', 'HEAD'] as const;
export const TREE_ENTRIES_ARGV = ['ls-tree', '-r', '-z'] as const;
export const BLOBS_ARGV = ['cat-file', '--batch'] as const;
export const HEAD_ARGV = ['rev-parse', '--verify', '--quiet', 'HEAD'] as const;
export const SYMBOLIC_HEAD_ARGV = ['symbolic-ref', '--quiet', 'HEAD'] as const;
export const PEEL_ARGV = ['cat-file', '--batch-check=%(objectname) %(objecttype)'] as const;
export const PEEL_SUFFIX = '^{}';
export const SHALLOW_FILE_ARGV = ['rev-parse', '--git-path', 'shallow'] as const;
export const REMOTES_OPTION = '--remotes';
export const REV_LIST_ARGV = ['rev-list'] as const;
export const TREE_ARGV = ['rev-parse', '--verify'] as const;
export const TREE_SUFFIX = '^{tree}';
export const REMOTE_ARGV = ['remote'] as const;

export const GIT_ENTRY_MODES = ['100644', '100755', '120000', '160000'] as const;
