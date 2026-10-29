export const COALESCING_SOURCE = `export function fallback(value) {
    const alternate = value || {};
    return alternate ?? {};
}
export const known = (value) => value ?? { known: true };
`;

export const COALESCING_CORRECTED = `export function fallback(value) {
    if (value === undefined) return;
    return value;
}
export const known = (value) => value ?? { known: true };
`;

export const CONFIGURATION_RULE_OPTIONS = {
    tables: '[tools.eslint.rules]\n"@typescript-eslint/no-floating-promises" = [{ ignoreVoid = true }]\n',
    files: {
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["source.ts"]}\n',
        'source.ts': 'void Promise.resolve();\nPromise.resolve();\n',
    },
} as const;

export const DOCUMENTED_PRICE_SOURCE = `/**
Add the two prices.
@param {number} first the first price.
@param {number} second the second price.
@returns {number} the total.
*/
export function addPrices(first, second) {
    return first + second;
}
`;

export const ESLINT_BUG_RULES = [
    'array-callback-return',
    'no-constructor-return',
    'no-new-func',
    'no-promise-executor-return',
    'no-return-assign',
    'no-self-compare',
    'no-template-curly-in-string',
    'no-unmodified-loop-condition',
    'no-unreachable-loop',
    'no-var',
] as const;

export const JAVASCRIPT_BUG_RULES = ['no-implied-eval', 'no-throw-literal', 'no-unused-expressions'] as const;

export const TYPESCRIPT_DEFAULT_RULES = [
    '@typescript-eslint/no-explicit-any',
    '@typescript-eslint/no-namespace',
    '@typescript-eslint/no-this-alias',
    '@typescript-eslint/triple-slash-reference',
] as const;

export const REMOVED_LEVEL_RULES = [
    'unicorn/no-array-for-each',
    'unicorn/no-hex-escape',
    'unicorn/no-nested-ternary',
    '@typescript-eslint/no-require-imports',
] as const;
