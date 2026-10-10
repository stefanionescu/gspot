// Lockfile parsers reject any merge-marker prefix; generated files require the token separator.
const CONFLICT_MARKER_SOURCE = '^(?:<{7}|={7}|>{7})';

export const UNSUPPORTED_ENTRY =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

/** Full SHA-1 and SHA-256 object IDs are supported across listings, reports, and push selection. */
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

export const CONFLICT_MARKER_PREFIX = new RegExp(CONFLICT_MARKER_SOURCE, 'mu');

export const CONFLICT_MARKERS = new RegExp(`${CONFLICT_MARKER_SOURCE}(?: |$)`, 'mu');
