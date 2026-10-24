import { HASH_SOURCE } from '#cli/config/repository/revisions/push.ts';
import { GITLINK_MODE, GIT_FILE_MODES } from '#cli/config/files/modes.ts';

export const UNSUPPORTED_INDEX_LINE =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

export const BLOB_HEADER = new RegExp(String.raw`^(${HASH_SOURCE}) blob (\d+)$`, 'u');

export const INDEX_LINE = new RegExp(
    String.raw`^(?<mode>\d{6}) (?<hash>${HASH_SOURCE}) (?<stage>[0-3])\t(?<path>[\s\S]+)$`,
    'u',
);

export const TREE_LINE = new RegExp(
    String.raw`^(?<mode>\d{6}) (?:blob|commit) (?<hash>${HASH_SOURCE})\t(?<path>[\s\S]+)$`,
    'u',
);

export const ATTRIBUTE_FIELDS = 3;

export const ATTRIBUTE_ASSIGNMENT_SIDES = 2;

export const ATTRIBUTE_LINE = /^("(?:[^"\\]|\\.)*"|\S+)(?:\s+|$)/u;

export const IGNORED_ATTRIBUTE_LINE = /^(?:#|\[attr\])/u;

export const IGNORED_ATTRIBUTE_PATTERN = /^!|\/$/u;

export const QUOTED_ATTRIBUTE_PATTERN = /^"(?:[^"\\]|\\.)*"$/u;

export const QUOTED_PATH_CHUNKS = /\\(?:[0-3][0-7]{2}|[\s\S])|[^\\]+/gu;

export const OCTAL_PATH_BYTE = /^\\[0-3][0-7]{2}$/u;

export const PATH_ESCAPES: Readonly<Record<string, string>> = {
    a: '\u{7}',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
    '\\': '\\',
    '"': '"',
};

export const INVALID_GIT_STREAM_MESSAGE = 'The Git object stream is incomplete or invalid.';

export const GIT_MODES = [...(Object.keys(GIT_FILE_MODES) as (keyof typeof GIT_FILE_MODES)[]), GITLINK_MODE] as const;

export const ANY_FOLDER_PREFIX = '**/';
