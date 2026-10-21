import { EXECUTABLE_FILE, PERMISSION_BITS, OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';

export const GITLINK_MODE = '160000';

export const SYMLINK_MODE = '120000';

export const ENTRY_FILE_MODES = {
    '100644': OWNER_WRITABLE_FILE,
    '100755': EXECUTABLE_FILE,
    [SYMLINK_MODE]: PERMISSION_BITS,
} as const;

export const REGULAR_FILE_MODES: ReadonlySet<string> = new Set(
    Object.keys(ENTRY_FILE_MODES).filter((mode) => mode !== SYMLINK_MODE),
);

export const UNSUPPORTED_ENTRY =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

/** Match a full SHA-1 or SHA-256 Git object hash. */
const HASH_SOURCE = '(?:[a-f0-9]{40}|[a-f0-9]{64})';

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

export const IGNORED_ATTRIBUTE_LINE = /^(?:#|\[attr\])/u;

export const IGNORED_ATTRIBUTE_PATTERN = /^!|\/$/u;

export const QUOTED_ATTRIBUTE_PATTERN = /^"(?:[^"\\]|\\.)*"$/u;

export const QUOTED_PATH_PARTS = /\\(?:[0-3][0-7]{2}|[\s\S])|[^\\]+/gu;

export const OCTAL_PATH_BYTE = /^\\[0-3][0-7]{2}$/u;

export const PATH_ESCAPES: Readonly<Record<string, string>> = {
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

export const BINARY_ATTRIBUTES = { diff: 'unset', merge: 'unset', text: 'unset' } as const;

export const BINARY_MACRO = 'binary';

export const INVALID_GIT_STREAM_MESSAGE = 'The Git object stream is incomplete or invalid.';

export const GIT_ENTRY_MODES = [
    ...(Object.keys(ENTRY_FILE_MODES) as (keyof typeof ENTRY_FILE_MODES)[]),
    GITLINK_MODE,
] as const;
