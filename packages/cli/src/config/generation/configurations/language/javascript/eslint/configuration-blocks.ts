import type { EslintPlugins, PluginRuleBlock } from '#cli/types/generation/eslint.ts';

const EXPO_RULES = {
    'expo/no-env-var-destructuring': 'error',
    'expo/no-dynamic-env-var': 'error',
    'expo/use-dom-exports': 'error',
    'expo/prefer-box-shadow': 'error',
} as const;

const EXPRESS_RULES = { 'security/detect-no-csrf-before-method-override': 'error' } as const;

const REACT_NATIVE_RULES = {
    '@react-native/platform-colors': 'error',
    '@react-native/no-deep-imports': 'error',
} as const;

const TRANSLATIONS_RULES = { 'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }] } as const;

export const REACT_FILES = ['**/*.{js,jsx,ts,tsx}'] as const;

const JSX_FILES = ['**/*.{jsx,tsx}'] as const;

const ZOD_RULES = [
    'no-any-schema',
    'no-coerce-boolean',
    'no-empty-custom-schema',
    'no-native-enum',
    'no-promise-schema',
    'no-throw-in-refine',
    'prefer-strict-object',
    'prefer-meta-last',
    'require-brand-type-parameter',
] as const;

const JEST_GLOBAL_PACKAGE = '@jest/globals';

export const CONFIGURATION_PLUGINS = {
    expo: { expoPlugin: ['expoPlugin', 'eslint-plugin-expo'] },
    'react-native': {
        reactNativePlatform: ['reactNativePlatform', '@react-native/eslint-plugin'],
    },
    zod: { zodPlugin: ['zodPlugin', 'eslint-plugin-zod'] },
    translations: { i18next: ['i18next', 'eslint-plugin-i18next'] },
    nextjs: {
        nextPlugin: ['nextPlugin', '@next/eslint-plugin-next'],
        reactRefresh: ['reactRefresh', 'eslint-plugin-react-refresh'],
    },
    vue: {
        vuePlugin: ['vuePlugin', 'eslint-plugin-vue'],
        vueParser: ['vueParser', 'vue-eslint-parser'],
        vueAccessibility: ['vueAccessibility', 'eslint-plugin-vuejs-accessibility'],
    },
    'react-dom': { accessibility: ['accessibility', 'eslint-plugin-jsx-a11y-x'] },
    astro: { astroPlugin: ['astroPlugin', 'eslint-plugin-astro'] },
    zustand: {},
    svelte: {
        sveltePlugin: ['sveltePlugin', 'eslint-plugin-svelte'],
        svelteParser: ['svelteParser', 'svelte-eslint-parser'],
    },
    nestjs: { nestjsTyped: ['nestjsTyped', '@darraghor/eslint-plugin-nestjs-typed'] },
    'tanstack-query': { tanstackQuery: ['tanstackQuery', '@tanstack/eslint-plugin-query'] },
    vitest: { vitest: ['vitest', '@vitest/eslint-plugin'] },
    typescript: {
        tseslint: ['tseslint', 'typescript-eslint'],
        '{ createTypeScriptImportResolver }': [
            '{ createTypeScriptImportResolver }',
            'eslint-import-resolver-typescript',
        ],
    },
    'testing-library': { testingLibrary: ['testingLibrary', 'eslint-plugin-testing-library'] },
    react: {
        reactHooks: ['reactHooks', 'eslint-plugin-react-hooks'],
        react: ['react', '@eslint-react/eslint-plugin'],
        reactRefresh: ['reactRefresh', 'eslint-plugin-react-refresh'],
    },
    drizzle: { drizzlePlugin: ['drizzlePlugin', 'eslint-plugin-drizzle'] },
    jest: { jest: ['jest', 'eslint-plugin-jest'] },
} as const satisfies Record<string, EslintPlugins>;

export const TEST_RULE_NAMES = [
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

export const PLUGIN_RULE_BLOCKS: Readonly<Record<string, PluginRuleBlock>> = {
    jest: {
        imports: CONFIGURATION_PLUGINS.jest,
        properties: `plugins: { jest }, languageOptions: { globals: jest.environments.globals.globals }, settings: { jest: { globalPackage: ${JSON.stringify(JEST_GLOBAL_PACKAGE)} } }`,
        files: 'tests',
        rules: {
            ...Object.fromEntries(TEST_RULE_NAMES.map((name) => [`jest/${name}`, 'error'])),
            'jest/valid-expect': ['error', { maxArgs: 1 }],
        },
    },
    expo: {
        imports: CONFIGURATION_PLUGINS.expo,
        properties: 'plugins: { expo: expoPlugin }',
        files: 'code',
        rules: EXPO_RULES,
    },
    express: { imports: {}, properties: '', files: 'code', rules: EXPRESS_RULES },
    'react-native': {
        imports: CONFIGURATION_PLUGINS['react-native'],
        properties: "plugins: { '@react-native': reactNativePlatform }",
        files: 'code',
        rules: REACT_NATIVE_RULES,
    },
    zod: {
        imports: CONFIGURATION_PLUGINS.zod,
        properties: 'plugins: { zod: zodPlugin }',
        files: 'code',
        rules: Object.fromEntries(ZOD_RULES.map((rule) => [`zod/${rule}`, 'error'])),
    },
    translations: {
        imports: CONFIGURATION_PLUGINS.translations,
        properties: 'plugins: { i18next }',
        files: JSX_FILES,
        ignoresTests: true,
        rules: TRANSLATIONS_RULES,
    },
};
