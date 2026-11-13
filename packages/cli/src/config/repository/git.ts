import { GIT_PROGRAM } from '#cli/config/system.ts';

// conflict markers
export const CONFLICT_END = /^>{7}(?: |$)/u;
export const CONFLICT_SEPARATOR = /^={7}(?: |$)/u;
export const CONFLICT_START = /^<{7}(?: |$)/u;

// git output
export const ANY_FOLDER_PREFIX = '**/';
export const ATTRIBUTE_ASSIGNMENT_SIDES = 2;
export const ATTRIBUTE_FIELDS = 3;
export const ATTRIBUTE_LINE = /^("(?:[^"\\]|\\.)*"|\S+)(?:\s+|$)/u;
const HASH_SOURCE = '(?:[a-f0-9]{40}|[a-f0-9]{64})';
export const BLOB_HEADER = new RegExp(String.raw`^(${HASH_SOURCE}) blob (\d+)$`, 'u');
export const FIRST_NON_PRINTABLE_BYTE = 127;
export const FIRST_PRINTABLE_BYTE = 32;
export const HASH_PATTERN = new RegExp(`^${HASH_SOURCE}$`, 'iu');
export const IGNORED_ATTRIBUTE_LINE = /^(?:#|\[attr\])/u;
export const IGNORED_ATTRIBUTE_PATTERN = /^!|\/$/u;
export const INDEX_LINE = new RegExp(
    String.raw`^(?<mode>\d{6}) (?<hash>${HASH_SOURCE}) (?<stage>[0-3])\t(?<path>[\s\S]+)$`,
    'u',
);
export const INVALID_GIT_STREAM_MESSAGE = 'The Git object stream is incomplete or invalid.';
export const LINE_FEED = 10;
export const OCTAL_BYTE_WIDTH = 3;
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
export const QUOTED_ATTRIBUTE_PATTERN = /^"(?:[^"\\]|\\.)*"$/u;
export const QUOTED_PATH_CHUNKS = /\\(?:[0-3][0-7]{2}|[\s\S])|[^\\]+/gu;
export const SIZE_GROUP = 2;
export const TREE_LINE = new RegExp(
    String.raw`^(?<mode>\d{6}) (?:blob|commit) (?<hash>${HASH_SOURCE})\t(?<path>[\s\S]+)$`,
    'u',
);
export const UNSUPPORTED_GIT_FILE_MESSAGE =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

// git process
export const COPIES_FOLDER = '.gspot-copies';
export const GIT_COMMAND_CONFIGURATION: ReadonlySet<string> = new Set(['GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS']);
export const GIT_CREATION_COMMANDS = [
    [GIT_PROGRAM, 'clone'],
    [GIT_PROGRAM, 'init'],
] as const;
export const GIT_FLAG_ARGUMENTS = ['config', '--bool', '--get'] as const;
export const GIT_FOLDER_VARIABLE = 'GIT_DIR';
export const GIT_LOCALE = { LC_ALL: 'C' } as const;
export const GIT_LOCAL_VARIABLES_ARGUMENTS = ['rev-parse', '--local-env-vars'] as const;
export const GIT_NONLOCAL_ENVIRONMENT_NAME = /^GIT_(?:PAGER|CONFIG_(?:COUNT|PARAMETERS|KEY_\d+|VALUE_\d+))$/u;
export const GIT_PATH_ARGUMENTS = ['rev-parse', '--path-format=absolute', '--git-path'] as const;
export const GIT_WORK_TREE_VARIABLE = 'GIT_WORK_TREE';
export const GIT_PATH_VARIABLES = [
    GIT_FOLDER_VARIABLE,
    GIT_WORK_TREE_VARIABLE,
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_COMMON_DIR',
    'GIT_GRAFT_FILE',
    'GIT_SHALLOW_FILE',
    'GIT_CONFIG',
] as const;
export const GIT_SETTING_ARGUMENTS = ['config', '--null', '--get'] as const;
export const GIT_TOP_LEVEL_ARGUMENTS = ['rev-parse', '--show-toplevel'] as const;
export const GIT_VARIABLE_PREFIX = 'GIT_';
export const NOT_REPOSITORY_CODE = 128;
export const NOT_REPOSITORY_MESSAGE = 'fatal: not a git repository (or any ';
export const SPARSE_CHECKOUT_MESSAGE = 'gspot does not support sparse checkouts. Run git sparse-checkout disable.';
export const SPARSE_CHECKOUT_SETTING = 'core.sparseCheckout';
export const TRAILING_NEWLINE = /\n$/u;
