export const DIGIT = /\d/u;

export const VERB_CATEGORIES = new Set(['functions', 'methods', 'variables']);

/** The identifier categories a setting can narrow to; every other category borrows the limits of one of these. */
export const CATEGORY_PARENTS: Record<string, string> = {
    classes: 'types',
    type_aliases: 'types',
    exceptions: 'types',
    methods: 'functions',
    constants: 'variables',
    attributes: 'properties',
    enum_cases: 'properties',
    modules: 'files',
    packages: 'directories',
};

export const SEPARATORS = /[^A-Za-z0-9]+/u;

export const LOWER_WORD = /^[a-z]+$/u;

export const CAMEL_WORD = /^[a-z][A-Za-z]*$/u;

export const PASCAL_WORD = /^[A-Z][A-Za-z]*$/u;

export const UPPER_WORD = /^[A-Z]+$/u;

export const TIMESTAMP = /^\d+$/u;

/** The digits of a migration timestamp, YYYYMMDDHHMMSS. */
export const MIGRATION_DIGITS = 14;

/** Technical words whose digits form part of their established spelling. */
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

export const NUMBER_PART = /^\d+$/u;
