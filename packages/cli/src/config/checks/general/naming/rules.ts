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

export const TEST_TERM_GROUP = 'tests';

export const RUFF_CATEGORIES: ReadonlySet<string> = new Set([
    'classes',
    'exceptions',
    'functions',
    'methods',
    'parameters',
]);

export const SWIFTLINT_PARENTS: ReadonlySet<string> = new Set(['types', 'variables']);
