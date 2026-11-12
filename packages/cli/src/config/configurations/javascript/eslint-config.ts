import { REACT_FILES } from '#cli/config/configurations/shared.ts';
import { MISE_TASK_FOLDERS } from '#cli/config/repository/setup.ts';
import type { PluginRuleBlock } from '#cli/types/configurations/javascript.ts';

// eslint config

export const BOUNDARIES_PLUGIN_PACKAGE = 'eslint-plugin-boundaries';

export const CONFIGURATION_BLOCKS_SUFFIX = 'Blocks';

export const ESLINT_CONFIG_API = 'eslint/config';

export const ESLINT_FIXES_FILE = 'fixes.mjs';

export const ESLINT_FUNCTIONS_FILE = 'functions.mjs';

export const ESLINT_PLUGIN_PACKAGES = [
    '@gspothq/eslint-plugin',
    'eslint-plugin-import-x',
    'eslint-plugin-jsdoc',
    'eslint-plugin-n',
    'eslint-plugin-regexp',
    'eslint-plugin-security',
] as const;

export const LEVEL_ALL_PLUGIN_PACKAGE = 'eslint-plugin-perfectionist';

export const UNICORN_PLUGIN_PACKAGE = 'eslint-plugin-unicorn';

// eslint block-calls

export const ESLINT_NAMED_IMPORTS: Readonly<Record<string, string | undefined>> = {
    'eslint-import-resolver-typescript': 'createTypeScriptImportResolver',
    [ESLINT_CONFIG_API]: 'defineConfig',
};

export const ESLINT_PACKAGE_IMPORTERS: Readonly<Record<string, string | undefined>> = {
    'eslint-plugin-astro': 'importAstroPlugin',
    'svelte-eslint-parser': 'importSvelteParser',
};

export const ESLINT_RUNTIMES_CONSTANT = 'runtimeDeclarations';

export const NAME_SEPARATOR = /[-/.](?<letter>[a-z0-9])/gu;

export const PACKAGE_SCOPE_MARK = /^@/u;

export const SHARED_LIST_MARK = '@shared:';

export const SHARED_LIST_REFERENCE = /"@shared:(?<name>\w+)"/gu;

// eslint configurations block

const EXPO_RULES = {
    'expo/no-env-var-destructuring': 'error',
    'expo/no-dynamic-env-var': 'error',
    'expo/use-dom-exports': 'error',
    'expo/prefer-box-shadow': 'error',
} as const;

const EXPRESS_RULES = { 'security/detect-no-csrf-before-method-override': 'error' } as const;

const JEST_GLOBAL_PACKAGE = '@jest/globals';

const JEST_RULE_NAMES = [
    'no-alias-methods',
    'no-done-callback',
    'no-export',
    'no-interpolation-in-snapshots',
    'no-jasmine-globals',
    'no-mocks-import',
    'no-test-prefixes',
    'valid-expect-in-promise',
    'valid-title',
];

const JSX_FILES = ['**/*.{jsx,tsx}'] as const;

const REACT_NATIVE_RULES = {
    '@react-native/platform-colors': 'error',
    '@react-native/no-deep-imports': 'error',
} as const;

const REACT_RULES = {
    '@eslint-react/no-missing-component-display-name': 'error',
    '@eslint-react/no-array-index-key': 'error',
    '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
    '@eslint-react/no-unstable-context-value': 'error',
    '@eslint-react/no-unstable-default-props': 'error',
} as const;

const TEST_RULE_NAMES = [
    'no-focused-tests',
    'no-disabled-tests',
    'no-identical-title',
    'no-standalone-expect',
    'no-commented-out-tests',
    'expect-expect',
    'valid-describe-callback',
    'no-conditional-expect',
    'valid-expect',
    'prefer-strict-equal',
] as const;

const TRANSLATIONS_RULES = { 'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }] } as const;

export const VAGUE_TEST_TITLE_WORDS = [
    'works',
    'happy path',
    'edge case',
    'edge cases',
    'test1',
    'removed',
    'no longer',
    'anymore',
    'deprecated',
    'legacy',
] as const;

const ZOD_RULES = {
    'zod/consistent-import': ['error', { syntax: 'named' }],
    'zod/prefer-strict-object': 'error',
    'zod/prefer-meta-last': 'error',
} as const;

export const PLUGIN_RULE_BLOCKS: Readonly<Record<string, PluginRuleBlock>> = {
    jest: {
        calls: [
            { name: 'addPlugins', args: [{ plugins: ['eslint-plugin-jest'] }] },
            { name: 'setJestGlobals', args: [{ package: 'eslint-plugin-jest' }] },
        ],
        fields: { settings: { jest: { globalPackage: JEST_GLOBAL_PACKAGE } } },
        files: 'tests',
        rules: {
            ...Object.fromEntries([...TEST_RULE_NAMES, ...JEST_RULE_NAMES].map((name) => [`jest/${name}`, 'error'])),
            'gspot/require-test-assertions': 'off',
            'jest/valid-expect': ['error', { maxArgs: 1 }],
        },
        allLevelRules: { 'jest/valid-title': ['error', { disallowedWords: VAGUE_TEST_TITLE_WORDS }] },
    },
    expo: {
        calls: [{ name: 'addPlugins', args: [{ plugins: ['eslint-plugin-expo'] }] }],
        files: 'code',
        rules: EXPO_RULES,
    },
    express: { files: 'code', rules: EXPRESS_RULES },
    'react-native': {
        calls: [{ name: 'addPlugins', args: [{ plugins: ['@react-native/eslint-plugin'] }] }],
        files: 'code',
        rules: REACT_NATIVE_RULES,
    },
    translations: {
        calls: [{ name: 'addPlugins', args: [{ plugins: ['eslint-plugin-i18next'] }] }],
        files: JSX_FILES,
        ignoresTests: true,
        rules: TRANSLATIONS_RULES,
    },
    zod: {
        calls: [{ name: 'addPlugins', args: [{ plugins: ['eslint-plugin-zod'] }] }],
        presets: [{ package: 'eslint-plugin-zod', path: 'configs.recommended', merge: 'rules' }],
        files: 'code',
        rules: ZOD_RULES,
    },
    'tanstack-query': {
        presets: [{ package: '@tanstack/eslint-plugin-query', path: 'configs.flat/recommended', merge: 'fields' }],
        files: 'code',
    },
    react: {
        calls: [
            {
                name: 'addPlugins',
                args: [
                    {
                        plugins: [
                            'eslint-plugin-react-hooks',
                            '@eslint-react/eslint-plugin',
                            'eslint-plugin-react-refresh',
                        ],
                    },
                ],
            },
        ],
        presets: [
            { package: '@eslint-react/eslint-plugin', path: 'configs.recommended', merge: 'fields' },
            { package: 'eslint-plugin-react-hooks', path: 'configs.flat.recommended-latest', merge: 'rules' },
            { package: 'eslint-plugin-react-refresh', path: 'configs.recommended', merge: 'rules' },
        ],
        files: REACT_FILES,
        rules: REACT_RULES,
    },
};

// eslint files

export const COMPONENT_CONFIGURATIONS = ['vue', 'svelte'] as const;

export const MISE_TASKS_GLOB = `{${MISE_TASK_FOLDERS.join(',')}}/**`;

// eslint plan

export const BOUNDARY_FOLDERS_CONSTANT = 'importBoundaryFolders';

// eslint runtimes

export const COMMONJS_FILES = '**/*.{cjs,cts}';

export const COMMONJS_PACKAGE_TYPE = 'commonjs';

export const ESLINT_BROWSER_CONFIGURATIONS = ['react', 'vue', 'svelte'] as const;

export const TYPELESS_JAVASCRIPT_FILES = '**/*.{js,jsx}';
