export const TOOL_DIRECTIVE_PREFIXES = [
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

export const ESLINT_LINE_DIRECTIVE = /^eslint-(?:disable|enable)(?:-(?:next-)?line)?(?:\s|$)/u;

export const ESLINT_BLOCK_DIRECTIVE = /^eslint(?:-(?:disable|enable|env))?(?:\s|$)/u;

export const TYPESCRIPT_DIRECTIVE = /^@?ts-(?:ignore|expect-error|nocheck|check)\b/u;

export const LEADING_STAR = /^\s*\*?/u;

export const LEADING_COMMENT_LINE_BREAKS = 2;
export const BLANK = /^\s*$/u;

export const LINE_BREAK_GAP = /^[\t ]*\r?\n[\t ]*$/u;
export const LEADING_LINE_BREAK = /^[\t ]*\r?\n/u;
