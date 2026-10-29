import type { FenceParser } from '#cli/types/checks/language/markdown.ts';

export const FORMAT_FENCE_PARSERS = ['json', 'jsonc', 'toml', 'yaml'] as const;

export const GRAMMAR_FENCE_PARSERS = ['bash', 'typescript', 'tsx', 'javascript', 'python'] as const;

export const ELLIPSIS_LINE = /^[\s#/]*\.\.\.\s*$/u;

export const ELLIPSIS_ARGUMENTS = '(...)';

export const ANGLE_PLACEHOLDER = /<[A-Za-z][A-Za-z0-9_-]*>/gu;

export const FENCE_PARSERS: ReadonlyMap<string, FenceParser> = new Map([
    ['json', 'json'],
    ['jsonc', 'jsonc'],
    ['toml', 'toml'],
    ['yaml', 'yaml'],
    ['yml', 'yaml'],
    ['bash', 'bash'],
    ['sh', 'bash'],
    ['shell', 'bash'],
    ['ts', 'typescript'],
    ['typescript', 'typescript'],
    ['tsx', 'tsx'],
    ['js', 'javascript'],
    ['jsx', 'javascript'],
    ['javascript', 'javascript'],
    ['mjs', 'javascript'],
    ['cjs', 'javascript'],
    ['python', 'python'],
    ['py', 'python'],
]);

export const JSON_FENCE_OPTIONS = { disallowComments: true, allowTrailingComma: false } as const;

export const OMITTED_BASH_LINE = ':';

export const EMPTY_ARGUMENTS = '()';

export const PLACEHOLDER_VALUE = 'PLACEHOLDER';

export const CAMEL_CASE_BOUNDARY = /(?<first>[a-z])(?<next>[A-Z])/gu;

export const CAMEL_CASE_REPLACEMENT = '$<first> $<next>';

export const SYNTAX_ERROR_MESSAGE = 'Syntax error.';
