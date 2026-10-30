import {
    SONAR_RULES,
    JSDOC_RULES,
    ESLINT_RULES,
    REGEXP_RULES,
    SORTING_RULES,
    UNICORN_RULES,
    SECURITY_RULES,
    IMPORT_X_RULES,
} from '#cli/config/generation/configurations/language/javascript/eslint/blocks/rules.ts';

export const GSPOT_PRESET_LEVELS = { basic: 'recommended', all: 'all' } as const;

export const IMPORT_LAYOUT_RULES = {
    'import-x/first': 'error',
    'import-x/newline-after-import': ['error', { count: 1, considerComments: true }],
} as const;

export const ESLINT_PLUGIN_IMPORTS = {
    gspot: ['gspot', '@gspothq/eslint-plugin'],
    'import-x': ['importX', 'eslint-plugin-import-x'],
    jsdoc: ['jsdoc', 'eslint-plugin-jsdoc'],
    n: ['nodePlugin', 'eslint-plugin-n'],
    regexp: ['regexp', 'eslint-plugin-regexp'],
    security: ['security', 'eslint-plugin-security'],
} as const;

export const RUNTIME_GLOBALS: Readonly<Record<string, string>> = { node: 'nodeBuiltin', commonjs: 'node' };

export const NODE_RUNTIMES: readonly string[] = ['node', 'nodeBuiltin', 'commonjs'];

export const LEVEL_ALL_PLUGIN_IMPORTS = {
    perfectionist: ['perfectionist', 'eslint-plugin-perfectionist'],
    'barrel-files': ['barrelFiles', 'eslint-plugin-barrel-files'],
} as const;

export const BOUNDARIES_PLUGIN_IMPORT = { boundaries: ['boundaries', 'eslint-plugin-boundaries'] } as const;

export const JAVASCRIPT_RULES = {
    'no-implied-eval': 'error',
    'no-throw-literal': 'error',
    'no-unused-expressions': 'error',
    'no-unused-vars': [
        'error',
        {
            args: 'all',
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
        },
    ],
    'jsdoc/require-param-type': 'error',
    'jsdoc/require-returns-type': 'error',
    'jsdoc/check-types': 'error',
    'jsdoc/no-undefined-types': 'error',
    'jsdoc/valid-types': 'error',
} as const;

export const SCRIPT_RULES = { 'n/no-process-exit': 'off', 'unicorn/no-process-exit': 'off' } as const;

export const TEST_CHECK_RULES = {
    'sonarjs/assertions-in-tests': 'error',
    'sonarjs/no-empty-test-file': 'error',
} as const;

export const TEST_RULES = {
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/require-param': 'off',
    'jsdoc/require-description': 'off',
    'jsdoc/require-param-description': 'off',
    'n/no-unpublished-import': 'off',
    'n/no-unpublished-require': 'off',
} as const;

export const ROOT_PACKAGE_JSON_RULES = { 'package-json/require-packageManager': 'error' } as const;

export const BASE_RULES = {
    ...ESLINT_RULES,
    ...SORTING_RULES,
    ...SONAR_RULES,
    ...UNICORN_RULES,
    ...SECURITY_RULES,
    ...JSDOC_RULES,
    ...REGEXP_RULES,
    ...IMPORT_X_RULES,
} as const;

export const NODE_RULES = {
    'n/no-unsupported-features/node-builtins': ['error', { allowExperimental: true }],
    'n/no-unsupported-features/es-builtins': 'error',
    'n/no-deprecated-api': 'error',
    'unicorn/no-process-exit': 'off',
    'n/no-unsupported-features/es-syntax': 'off',
    'n/no-sync': 'off',
    'n/no-callback-literal': 'error',
    'n/no-new-require': 'error',
    'n/no-path-concat': 'error',
    'n/no-missing-import': 'off',
    'n/no-missing-require': 'off',
    'n/no-unpublished-import': ['error', { ignoreTypeImport: true }],
    'n/no-unpublished-require': 'error',
    'n/no-extraneous-import': 'error',
    'n/no-extraneous-require': 'error',

    'n/prefer-global/url-search-params': 'error',
    'n/prefer-global/url': 'error',
    'n/prefer-global/process': 'error',
    'n/prefer-global/console': 'error',
    'n/prefer-global/buffer': 'error',
    'n/no-process-exit': 'error',
    'n/prefer-promises/dns': 'error',
    'n/prefer-promises/fs': 'error',
} as const;

export const CONSOLE_RULES = { 'no-console': 'error' } as const;

export const IMPORT_BOUNDARIES_RULE = 'gspot/import-boundaries';

export const PACKAGE_JSON_PATTERN = '**/package.json';

export const PIN_RANGES_RULE = 'package-json/restrict-dependency-ranges';

export const PUBLISHED_PIN_OPTIONS = { forDependencyTypes: ['devDependencies'], rangeType: 'pin' } as const;

export const PRIVATE_PIN_OPTIONS = { rangeType: 'pin' } as const;

export const GSPOT_RULE_PREFIX = 'gspot/';

export const BOUNDARIES_FILES_SETTING = 'boundaries/files';
