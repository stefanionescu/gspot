export const TOOL_DIRECTIVE_PREFIXES = [
    'eslint',
    'global ',
    'globals ',
    'exported ',
    'jshint ',
    'jslint ',
    'istanbul ',
    'c8 ',
    'v8 ',
    '@vitest',
    '@jest',
    'biome-ignore',
    'oxlint-',
    'prettier-ignore',
    'nosemgrep',
    'dprint-ignore',
    'deno-lint-ignore',
] as const;

export const TYPESCRIPT_DIRECTIVE = /^@?ts-(?:ignore|expect-error|nocheck|check)\b/u;

export const LEADING_STAR = /^\s*\*?/u;

/** The most line breaks between the end of a leading comment and the start of its declaration. */
export const LEADING_COMMENT_LINE_BREAKS = 2;
export const BLANK = /^\s*$/u;

export const LINE_BREAK_GAP = /^[\t ]*\r?\n[\t ]*$/u;
export const LEADING_LINE_BREAK = /^[\t ]*\r?\n/u;
