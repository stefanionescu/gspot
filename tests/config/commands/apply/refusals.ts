/** Files that link outside the repository, and the error that refuses each one. */
export const LINKED_FILE_CASES = [
    {
        path: 'gspot.toml',
        outside: 'configurations = []\n',
        files: {},
        message: 'gspot.toml is not a regular file with one link. Use a regular file without extra hard links.',
    },
    {
        path: '.gspot/version',
        outside: '0.0.1\n',
        files: { 'project/gspot.toml': 'configurations = []\n' },
        message: '.gspot/version is not a regular file with one link. Use a regular file without extra hard links.',
    },
] as const;
