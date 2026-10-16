const UNSUPPORTED_ENTRY =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

/** Support full Git object hashes across listings, reports, and push selection. */
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
const LEADING_SLASH = /^\//u;
const BINARY_ATTRIBUTES = { diff: 'unset', merge: 'unset', text: 'unset' } as const;
const BINARY_MACRO = 'binary';

const INVALID_GIT_STREAM_MESSAGE = 'The Git object stream is incomplete or invalid.';

export {
    TREE_ENTRY,
    BLOB_HEADER,
    INDEX_ENTRY,
    HASH_PATTERN,
    BINARY_MACRO,
    LEADING_SLASH,
    ATTRIBUTE_LINE,
    ATTRIBUTE_FIELDS,
    UNSUPPORTED_ENTRY,
    BINARY_ATTRIBUTES,
    INVALID_GIT_STREAM_MESSAGE,
};
