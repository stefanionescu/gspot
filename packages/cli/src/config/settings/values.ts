export const ISO_DATE_LENGTH = 10;

// A category key has two parts after the language: naming.<language>.<category>.<setting>.
export const CATEGORY_KEY_PARTS = 2;

export const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);

// Defaults of single values from these configuration groups win over the defaults of other groups.
export const OVERRIDING_KINDS = new Set<string>(['framework', 'platform', 'library', 'database']);

export const REASON_WORDS_MIN = 2;

export const ALL_LANGUAGES = '*';
export const COMMAND_CHECK_DEFAULTS = {
    level: 'recommended',
    runs: 'files',
    files: {
        extensions: [],
        filenames: [],
        tags: [],
        languages: false,
        prettier_plugins: false,
        eslint_plugins: false,
        kinds: ['source', 'generated'],
    },
} as const;

export const TOOL_TIMEOUT_SETTING = 'tool_timeout_seconds';

export const ENVIRONMENT_READERS_ROLE = 'environment_readers';

/** Scope tables leave out these root records but keep their normalized list fields. */
export const SCOPE_EMPTY_RECORDS = [
    ['naming', 'override'],
    ['coverage', 'swift_target'],
    ['docs', 'banned_headings'],
    ['licenses', 'allowed_package'],
    ['site', 'size_limit'],
] as const;
