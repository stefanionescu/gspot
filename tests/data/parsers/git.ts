export const SHA1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const INVALID_PATH_PREFIX = `100644 ${SHA1} 0\t`;

export const SHA256 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const LINE_FEED_BYTE = 10;
const INVALID_UTF8_BYTE = 255;
const CARRIAGE_RETURN_BYTE = 13;

export const BINARY_BLOB = [0, LINE_FEED_BYTE, INVALID_UTF8_BYTE, CARRIAGE_RETURN_BYTE, 0] as const;

export const ENTRY_PATH = 'folder/a\n"é.sql';

export const ENTRY_FAILURE =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

export const INVALID_ENTRIES = [
    { name: 'unmerged index stage', output: `100644 ${SHA1} 1\tsource.ts\0` },
    { name: 'unsupported mode', output: `100600 ${SHA1} 0\tsource.ts\0` },
    { name: 'short object ID', output: '100644 aaaa 0\tsource.ts\0' },
    { name: 'empty path', output: `100644 ${SHA1} 0\t\0` },
    {
        name: 'invalid UTF-8 path',
        message: 'Git listed a path that is not valid UTF-8.',
        output: { prefix: INVALID_PATH_PREFIX, bytes: [INVALID_UTF8_BYTE, 0] },
    },
] as const;

export const BLOB_FAILURE = 'The Git object stream is incomplete or invalid.';

export const INVALID_BLOBS = [
    { name: 'missing header terminator', output: `${SHA1} blob 0` },
    { name: 'wrong object identity', output: `${SHA256} blob 0\n\n` },
    { name: 'non-blob object', output: `${SHA1} tree 0\n\n` },
    { name: 'missing object', output: `${SHA1} missing\n` },
    { name: 'unsafe byte count', output: `${SHA1} blob 9007199254740992\n\n` },
    { name: 'truncated content', output: `${SHA1} blob 3\nab\n` },
    { name: 'missing body terminator', output: `${SHA1} blob 2\nab` },
] as const;

export const ATTRIBUTE_LINES = [
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
