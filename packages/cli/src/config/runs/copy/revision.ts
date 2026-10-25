export const GIT_HASH_ARGUMENTS = ['hash-object', '--stdin-paths'] as const;

export const OWNER_WRITABLE_FOLDER = 0o755;

export const GIT_SET_HEAD_ARGUMENTS = ['update-ref', '--no-deref', 'HEAD'] as const;

export const GIT_EMPTY_INDEX_ARGUMENTS = ['read-tree', '--empty'] as const;

export const GIT_UPDATE_INDEX_ARGUMENTS = ['update-index', '-z', '--index-info'] as const;

export const GIT_WRITE_TREE_ARGUMENTS = ['write-tree'] as const;

export const GIT_HASH_FORMAT_ARGUMENTS = ['rev-parse', '--show-object-format'] as const;

export const GIT_INIT_ARGUMENTS = ['init', '--quiet'] as const;

export const GIT_PATH_ARGUMENTS = ['rev-parse', '--path-format=absolute', '--git-path'] as const;

export const GIT_VERIFY_HEAD_ARGUMENTS = ['rev-parse', '--verify', 'HEAD'] as const;

export const DEPENDENCY_REVISION_NOTE =
    'The dependency files in the working tree differ from the checked revision; the checks used the installed dependencies.';
