const INVALID_PATH_PREFIX = [
    49, 48, 48, 54, 52, 52, 32, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97,
    97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 32, 48, 9,
];

export const SHA1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

export const SHA256 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

export const BINARY_BLOB = [0, 10, 255, 13, 0];

export const ENTRY_PATH = 'folder/a\n"é.sql';

export const ENTRY_FAILURE =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

export const INVALID_ENTRIES = [
    {
        message: 'The Git entry stream is incomplete.',
        name: 'missing NUL terminator',
        output: `100644 ${SHA1} 0\tsource.ts`,
    },
    { message: ENTRY_FAILURE, name: 'unmerged index stage', output: `100644 ${SHA1} 1\tsource.ts\0` },
    { message: ENTRY_FAILURE, name: 'unsupported mode', output: `100600 ${SHA1} 0\tsource.ts\0` },
    { message: ENTRY_FAILURE, name: 'short object ID', output: '100644 aaaa 0\tsource.ts\0' },
    { message: ENTRY_FAILURE, name: 'empty path', output: `100644 ${SHA1} 0\t\0` },
    {
        name: 'invalid UTF-8 path',
        message: 'Revision paths must be valid UTF-8.',
        output: [...INVALID_PATH_PREFIX, 255, 0],
    },
];

export const BLOB_FAILURE = 'The Git object stream is incomplete or invalid.';

export const INVALID_BLOBS = [
    { message: BLOB_FAILURE, name: 'missing header terminator', output: `${SHA1} blob 0` },
    { message: BLOB_FAILURE, name: 'wrong object identity', output: `${SHA256} blob 0\n\n` },
    { message: BLOB_FAILURE, name: 'non-blob object', output: `${SHA1} tree 0\n\n` },
    { message: BLOB_FAILURE, name: 'missing object', output: `${SHA1} missing\n` },
    { message: BLOB_FAILURE, name: 'unsafe byte count', output: `${SHA1} blob 9007199254740992\n\n` },
    { message: BLOB_FAILURE, name: 'truncated content', output: `${SHA1} blob 3\nab\n` },
    { message: BLOB_FAILURE, name: 'missing body terminator', output: `${SHA1} blob 2\nab` },
    { message: BLOB_FAILURE, name: 'incorrect body terminator', output: `${SHA1} blob 2\nabx` },
    {
        message: 'The Git object stream contains unexpected data.',
        name: 'trailing response data',
        output: `${SHA1} blob 0\n\nextra`,
    },
];
