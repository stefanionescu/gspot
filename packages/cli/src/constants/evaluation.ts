// The literal values evaluation reads: names, patterns, limits, and tables.

// The Prettier options the policy models as format fields; every other option is carried under extra.
export const MODELED_OPTIONS = new Set([
    'tabWidth',
    'printWidth',
    'trailingComma',
    'endOfLine',
    'semi',
    'useTabs',
    'singleQuote',
]);
export const MODULE_CONFIGURATION = /\.[cm]?[jt]s$/u;
export const PACKAGE_CONFIGURATION = /^package\.(?:json|yaml)$/u;
// The ESLint severities that switch a rule on.
export const ACTIVE_LEVELS = new Set<unknown>([1, 2, 'warn', 'error']);
export const CONFIG_KEYS = [
    'env',
    'globals',
    'noInlineConfig',
    'parserOptions',
    'reportUnusedDisableDirectives',
    'rules',
    'settings',
    'processor',
];
