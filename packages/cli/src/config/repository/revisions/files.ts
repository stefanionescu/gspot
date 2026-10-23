export const GIT_LS_TREE_ARGUMENTS = ['ls-tree', '-r', '-z'] as const;

export const GIT_BLOBS_ARGUMENTS = ['cat-file', '--batch'] as const;

export const GIT_HEAD_ARGUMENTS = ['rev-parse', '--verify', '--quiet', 'HEAD'] as const;

export const GIT_SYMBOLIC_HEAD_ARGUMENTS = ['symbolic-ref', '--quiet', 'HEAD'] as const;
