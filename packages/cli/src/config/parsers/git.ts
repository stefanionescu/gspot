const UNSUPPORTED_ENTRY =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

/** Match a full SHA-1 or SHA-256 Git object hash. */
const HASH_SOURCE = '(?:[a-f0-9]{40}|[a-f0-9]{64})';

const HASH_PATTERN = new RegExp(`^${HASH_SOURCE}$`, 'u');

const BLOB_HEADER = new RegExp(String.raw`^(${HASH_SOURCE}) blob (\d+)$`, 'u');

const INDEX_ENTRY = new RegExp(
    String.raw`^(?<mode>\d{6}) (?<hash>${HASH_SOURCE}) (?<stage>[0-3])\t(?<path>[\s\S]+)$`,
    'u',
);

const TREE_ENTRY = new RegExp(
    String.raw`^(?<mode>\d{6}) (?:blob|commit) (?<hash>${HASH_SOURCE})\t(?<path>[\s\S]+)$`,
    'u',
);

const ATTRIBUTE_FIELDS = 3;

const ATTRIBUTE_LINE = /^("(?:[^"\\]|\\.)*"|\S+)(?:\s+|$)/u;
const IGNORED_ATTRIBUTE_LINE = /^(?:#|\[attr\])/u;
const IGNORED_ATTRIBUTE_PATTERN = /^!|\/$/u;
const QUOTED_ATTRIBUTE_PATTERN = /^"(?:[^"\\]|\\.)*"$/u;
const QUOTED_PATH_PARTS = /\\(?:[0-3][0-7]{2}|[\s\S])|[^\\]+/gu;
const OCTAL_PATH_BYTE = /^\\[0-3][0-7]{2}$/u;
const PATH_ESCAPES: Readonly<Record<string, string>> = {
    a: '\u0007',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
    '\\': '\\',
    '"': '"',
};
const BINARY_ATTRIBUTES = { diff: 'unset', merge: 'unset', text: 'unset' } as const;
const BINARY_MACRO = 'binary';

const INVALID_GIT_STREAM_MESSAGE = 'The Git object stream is incomplete or invalid.';

export {
    TREE_ENTRY,
    BLOB_HEADER,
    INDEX_ENTRY,
    HASH_PATTERN,
    BINARY_MACRO,
    PATH_ESCAPES,
    ATTRIBUTE_LINE,
    OCTAL_PATH_BYTE,
    ATTRIBUTE_FIELDS,
    QUOTED_PATH_PARTS,
    UNSUPPORTED_ENTRY,
    BINARY_ATTRIBUTES,
    IGNORED_ATTRIBUTE_LINE,
    QUOTED_ATTRIBUTE_PATTERN,
    IGNORED_ATTRIBUTE_PATTERN,
    INVALID_GIT_STREAM_MESSAGE,
};
