import type { FenceParser } from '#cli/types/configurations/language.ts';

export const MARKDOWNLINT_ALL_RULES = ['MD041', 'MD025'] as const;

export const MARKDOWNLINT_RULES = {
    MD018: true,
    MD020: true,
    MD033: false,
    MD024: { siblings_only: true },
    MD026: { punctuation: '.,;:!。，；：！' },
    MD046: { style: 'fenced' },
    MD059: {
        prohibited_texts: [
            'here',
            'this',
            'this page',
            'read more',
            'more',
            'click here',
            'link',
            'documentation',
            'docs',
        ],
    },
} as const;

export const PRETTIER_STYLE = 'markdownlint/style/prettier';

// The rules that markdownlint's prettier style turns off, less MD018 and MD020, which gspot turns back on.
export const MARKDOWNLINT_PRETTIER_DISABLED = [
    'MD003',
    'MD005',
    'MD007',
    'MD009',
    'MD010',
    'MD012',
    'MD013',
    'MD019',
    'MD021',
    'MD022',
    'MD023',
    'MD027',
    'MD028',
    'MD029',
    'MD030',
    'MD031',
    'MD032',
    'MD035',
    'MD048',
    'MD049',
    'MD050',
] as const;

export const ELLIPSIS_ARGUMENTS = '(...)';

export const ANGLE_PLACEHOLDER = /<[A-Za-z][\w-]*>/gu;

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

export const EMPTY_ARGUMENTS = '()';

export const PLACEHOLDER_VALUE = 'PLACEHOLDER';

export const CAMEL_CASE_BOUNDARY = /(?<first>[a-z])(?<next>[A-Z])/gu;

export const SYNTAX_ERROR_MESSAGE = 'Syntax error.';
