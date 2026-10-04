// Comment and whitespace analysis.
export const DIRECTIVE_PREFIXES = [
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
];

export const TS_DIRECTIVE = /^@?ts-(?:ignore|expect-error|nocheck|check)\b/u;

export const LEADING_STAR = /^\s*\*?/u;

/** Maximum line gap between a declaration and its leading comment. */
export const BLANK_LINE_DISTANCE = 2;
