export const UNSUPPORTED_ENTRY =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

/** Support full Git object hashes across listings, reports, and push selection. */
export const HASH_SOURCE = '(?:[a-f0-9]{40}|[a-f0-9]{64})';

export const HASH_PATTERN = new RegExp(`^${HASH_SOURCE}$`, 'u');

export const BLOB_HEADER = new RegExp(String.raw`^(${HASH_SOURCE}) blob (\d+)$`, 'u');

export const INDEX_ENTRY = new RegExp(
    String.raw`^(?<mode>\d{6}) (?<hash>${HASH_SOURCE}) (?<stage>[0-3])\t(?<path>[\s\S]+)$`,
    'u',
);

export const TREE_ENTRY = new RegExp(
    String.raw`^(?<mode>\d{6}) (?:blob|commit) (?<hash>${HASH_SOURCE})\t(?<path>[\s\S]+)$`,
    'u',
);

export const ATTRIBUTE_FIELDS = 3;

export const ATTRIBUTE_LINE = /^("(?:[^"\\]|\\.)*"|\S+)(?:\s+|$)/u;
export const LEADING_SLASH = /^\//u;
export const BINARY_ATTRIBUTES = { diff: 'unset', merge: 'unset', text: 'unset' } as const;
export const BINARY_MACRO = 'binary';
