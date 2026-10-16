const INVALID_PATH_PREFIX = '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\t';

const SHA1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const SHA256 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const LINE_FEED_BYTE = 10;
const INVALID_UTF8_BYTE = 255;
const CARRIAGE_RETURN_BYTE = 13;

const BINARY_BLOB = [0, LINE_FEED_BYTE, INVALID_UTF8_BYTE, CARRIAGE_RETURN_BYTE, 0] as const;

const ENTRY_PATH = 'folder/a\n"é.sql';

const ENTRY_FAILURE =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

const INVALID_ENTRIES = [
    { message: ENTRY_FAILURE, name: 'unmerged index stage', output: `100644 ${SHA1} 1\tsource.ts\0` },
    { message: ENTRY_FAILURE, name: 'unsupported mode', output: `100600 ${SHA1} 0\tsource.ts\0` },
    { message: ENTRY_FAILURE, name: 'short object ID', output: '100644 aaaa 0\tsource.ts\0' },
    { message: ENTRY_FAILURE, name: 'empty path', output: `100644 ${SHA1} 0\t\0` },
    {
        name: 'invalid UTF-8 path',
        message: 'Revision paths must be valid UTF-8.',
        output: { prefix: INVALID_PATH_PREFIX, bytes: [INVALID_UTF8_BYTE, 0] },
    },
] as const;

const BLOB_FAILURE = 'The Git object stream is incomplete or invalid.';

const INVALID_BLOBS = [
    { message: BLOB_FAILURE, name: 'missing header terminator', output: `${SHA1} blob 0` },
    { message: BLOB_FAILURE, name: 'wrong object identity', output: `${SHA256} blob 0\n\n` },
    { message: BLOB_FAILURE, name: 'non-blob object', output: `${SHA1} tree 0\n\n` },
    { message: BLOB_FAILURE, name: 'missing object', output: `${SHA1} missing\n` },
    { message: BLOB_FAILURE, name: 'unsafe byte count', output: `${SHA1} blob 9007199254740992\n\n` },
    { message: BLOB_FAILURE, name: 'truncated content', output: `${SHA1} blob 3\nab\n` },
    { message: BLOB_FAILURE, name: 'missing body terminator', output: `${SHA1} blob 2\nab` },
] as const;

const PUSH_CHECK_ARGUMENTS = ['check', '--hook', 'pre-push', '--only', 'project/bash-syntax', '--json', '--'] as const;

const TOOL_PROJECT_BYTE_ATTRIBUTES = '\n.gspot/* -text\n';

export {
    SHA1,
    SHA256,
    ENTRY_PATH,
    BINARY_BLOB,
    INVALID_BLOBS,
    INVALID_ENTRIES,
    PUSH_CHECK_ARGUMENTS,
    TOOL_PROJECT_BYTE_ATTRIBUTES,
};
