export const UNUSED_RECORD_RULE = 'unused-record';

export const REST_SEGMENT = /^\.\.\./u;

export const SEPARATORS = /[^A-Za-z0-9]+/u;

export const DIGIT_BOUNDARY = /(?<=\D)(?=\d)|(?<=\d)(?=\D)/u;

export const NUMERIC_WORDS = new Set([
    'base64',
    'utf8',
    'utf16',
    'sha1',
    'sha256',
    'sha512',
    'md5',
    'oauth2',
    'http2',
    'http3',
    'ipv4',
    'ipv6',
    's3',
    'k8s',
    'e2e',
    'i18n',
    'l10n',
    'a11y',
    'int8',
    'int16',
    'int32',
    'int64',
    'uint8',
    'uint16',
    'uint32',
    'uint64',
    'float32',
    'float64',
]);

export const MIGRATION_DIGITS = 14;

export const LOWER_WORD = /^[a-z]+$/u;

export const CAMEL_WORD = /^[a-z][A-Za-z]*$/u;

export const PASCAL_WORD = /^[A-Z][A-Za-z]*$/u;

export const UPPER_WORD = /^[A-Z]+$/u;

export const BANNED_WORD_FORMS: Readonly<Record<string, readonly string[]>> = {
    catalog: ['catalog', 'catalogue'],
    sync: ['sync', 'synchronize'],
    resolve: ['resolve', 'resolution'],
};

export const WORD_FORM_CONSONANT = /[aeiou][bcdfghjklmnpqrstvwxyz]$/u;

export const WORD_FORM_SUFFIXES = ['s', 'es', 'ed', 'ing', 'ings'] as const;

export const DIGIT_RUNS = /\d+/gu;

export const LAST_EXTENSION = /\.[^.]*$/u;

export const DIGIT = /\d/u;

export const TEST_WORD_LIST = 'tests';

export const RUFF_CATEGORIES: ReadonlySet<string> = new Set([
    'classes',
    'exceptions',
    'functions',
    'methods',
    'parameters',
]);

export const SWIFTLINT_CATEGORIES: ReadonlySet<string> = new Set([
    'types',
    'classes',
    'type_aliases',
    'exceptions',
    'variables',
    'constants',
]);

export const VOWEL_SUFFIX = /^[aeiou]/u;

export const SILENT_E = 'e';
export const TRAILING_Y = 'y';
export const RULES = {
    case: 'case',
    digits: 'digits',
    length: 'length',
    words: 'words',
    duplicateWords: 'duplicate-words',
    bannedWord: 'banned-word',
} as const;
