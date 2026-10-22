export const GIT_HASH_ARGUMENTS = ['hash-object', '--stdin-paths'] as const;

export const OWNER_WRITABLE_FOLDER = 0o755;

export const GIT_SHARED_CLONE_ARGUMENTS = ['clone', '--shared', '--no-checkout', '--quiet', '--'] as const;

export const GIT_SET_HEAD_ARGUMENTS = ['update-ref', '--no-deref', 'HEAD'] as const;

export const GIT_EMPTY_INDEX_ARGUMENTS = ['read-tree', '--empty'] as const;

export const GIT_UPDATE_INDEX_ARGUMENTS = ['update-index', '-z', '--index-info'] as const;

export const GIT_WRITE_TREE_ARGUMENTS = ['write-tree'] as const;
