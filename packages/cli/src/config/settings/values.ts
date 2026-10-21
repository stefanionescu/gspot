import type { CheckDeclaration } from '#cli/types/configurations.ts';

export const ISO_DATE_LENGTH = 10;

// A category key has two parts after the language: naming.<language>.<category>.<setting>.
export const CATEGORY_KEY_PARTS = 2;

export const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);

// Defaults of single values from these configuration groups win over the defaults of other groups.
export const OVERRIDING_GROUPS = new Set<string>(['framework', 'platform', 'library', 'database']);

export const REASON_WORDS_MIN = 2;

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
} satisfies Pick<CheckDeclaration, 'level' | 'runs'> & {
    files: Omit<NonNullable<CheckDeclaration['files']>, 'paths'>;
};
