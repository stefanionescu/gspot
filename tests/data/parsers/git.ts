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
    { name: 'unmerged index stage', output: `100644 ${SHA1} 1\tsource.ts\0` },
    { name: 'unsupported mode', output: `100600 ${SHA1} 0\tsource.ts\0` },
    { name: 'short object ID', output: '100644 aaaa 0\tsource.ts\0' },
    { name: 'empty path', output: `100644 ${SHA1} 0\t\0` },
    {
        name: 'invalid UTF-8 path',
        message: 'Revision paths must be valid UTF-8.',
        output: { prefix: INVALID_PATH_PREFIX, bytes: [INVALID_UTF8_BYTE, 0] },
    },
] as const;

const BLOB_FAILURE = 'The Git object stream is incomplete or invalid.';

const INVALID_BLOBS = [
    { name: 'missing header terminator', output: `${SHA1} blob 0` },
    { name: 'wrong object identity', output: `${SHA256} blob 0\n\n` },
    { name: 'non-blob object', output: `${SHA1} tree 0\n\n` },
    { name: 'missing object', output: `${SHA1} missing\n` },
    { name: 'unsafe byte count', output: `${SHA1} blob 9007199254740992\n\n` },
    { name: 'truncated content', output: `${SHA1} blob 3\nab\n` },
    { name: 'missing body terminator', output: `${SHA1} blob 2\nab` },
] as const;

const PUSH_CHECK_ARGUMENTS = ['check', '--hook', 'pre-push', '--only', 'project/bash-syntax', '--json', '--'] as const;

const TOOL_PROJECT_BYTE_ATTRIBUTES = '\n.gspot/* -text\n';

const ATTRIBUTE_LINES = [
    { line: String.raw`"na\303\257ve.txt" binary`, expected: [{ pattern: '**/naïve.txt', attributes: ['binary'] }] },
    { line: '[attr]gen linguist-generated', expected: [] },
    {
        line: String.raw`"a\ab\bc\fd\ne\rf\tg\vh\\i\"j.txt" text`,
        expected: [{ pattern: '**/a\u0007b\bc\fd\ne\rf\tg\vh\\i"j.txt', attributes: ['text'] }],
    },
    { line: '"日本語 naïve.txt" text', expected: [{ pattern: '**/日本語 naïve.txt', attributes: ['text'] }] },
    { line: String.raw`"bad\q.txt" text`, expected: [] },
    { line: String.raw`"bad\12.txt" text`, expected: [] },
    { line: String.raw`"bad\400.txt" text`, expected: [] },
];

export {
    SHA1,
    SHA256,
    ENTRY_PATH,
    BINARY_BLOB,
    BLOB_FAILURE,
    ENTRY_FAILURE,
    INVALID_BLOBS,
    INVALID_ENTRIES,
    ATTRIBUTE_LINES,
    PUSH_CHECK_ARGUMENTS,
    TOOL_PROJECT_BYTE_ATTRIBUTES,
};
