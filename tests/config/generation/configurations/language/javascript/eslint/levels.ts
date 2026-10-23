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

export const LEVEL_RULE_OPTIONS =
    '[limits.javascript]\ntrivial_function_statements = 4\n[tools.eslint.rules]\n"n/no-process-exit" = []\n"jsdoc/require-description" = []\n';

export const UNAPPLIED_RULE_OPTIONS =
    '[tools.eslint.rules]\n"n/no-process-exit" = []\n"id-length" = []\n"acme/foo" = []\n';

export const UNAPPLIED_RULE_REFUSALS = [
    'n/no-process-exit runs only at level all. gspot sets options only for the rules that run at level recommended.',
    'gspot runs id-length at no level, so it takes no options. For a rule of your own, add a [[tools.eslint.plugins]] record.',
    'acme/foo belongs to no plugin that gspot loads. For a rule of your own, add a [[tools.eslint.plugins]] record.',
] as const;

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
 * Add the two prices.
 * @param {number} first the first price.
 * @param {number} second the second price.
 * @returns {number} the total.
 */
export function addPrices(first, second) {
    return first + second;
}
`;
