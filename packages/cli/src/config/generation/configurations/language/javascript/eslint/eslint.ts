import { JSON_INDENT } from '#cli/config/text.ts';
import type { EslintPlugins, PluginRuleBlock } from '#cli/types/generation/eslint.ts';
import { PACKAGE_JSON_PATTERN } from '#cli/config/generation/configurations/language/javascript/eslint/blocks/blocks.ts';

export const PRESET_IMPORTERS: Readonly<Record<string, string | undefined>> = {
    astroPlugin: 'importAstroPlugin',
    svelteParser: 'importSvelteParser',
};

export const ESLINT_FUNCTIONS_FILE = 'functions.mjs';

export const GLOBALS_IMPORT = ['globals', 'globals'] as const;

export const CONFIGURATION_BLOCKS_SUFFIX = 'Blocks';

export const NAME_HYPHEN = /-(?<letter>[a-z0-9])/gu;

export const ESLINT_BASE_LABEL = 'javascript';

export const PRESETS_AFTER_CONFIGURATIONS = [
    {
        importName: 'packageJson',
        package: 'eslint-plugin-package-json',
        path: 'configs.recommended',
        files: [PACKAGE_JSON_PATTERN],
    },
    { importName: 'prettierConfig', package: 'eslint-config-prettier', path: '' },
] as const;

export const PRESETS_BEFORE_CONFIGURATIONS = [
    { importName: 'eslint', package: '@eslint/js', path: 'configs.recommended' },
    { importName: 'sonarjs', package: 'eslint-plugin-sonarjs', path: 'configs.recommended' },
    { importName: 'unicorn', package: 'eslint-plugin-unicorn', path: 'configs.recommended' },
] as const;

export const ESLINT_SETTINGS_TABLE = 'tools.eslint';

export const ESLINT_CHECK = 'javascript/eslint';

export const ESLINT_INDENT = ' '.repeat(JSON_INDENT);

export const COMPONENT_CONFIGURATIONS = ['vue', 'svelte'] as const;

export const CODE_LANGUAGES = ['javascript', 'typescript'] as const;

export const BASE_SELECTORS = [
    {
        selector: ':matches(Program, BlockStatement, StaticBlock) > BlockStatement',
        message: 'A block that stands alone hides a step. Name the step as a function, or remove the braces.',
    },
    {
        selector: 'TSEnumDeclaration',
        message: 'Use a literal union or an as-const object instead of an enum.',
    },
    {
        selector:
            ':matches(TSAsExpression[expression.type="TSAsExpression"], TSTypeAssertion[expression.type="TSTypeAssertion"])',
        message: 'Do not assert twice. Narrow the value, fix its type, or check it at run time.',
    },
    {
        selector: ':matches(TSAsExpression, TSTypeAssertion) > TSAnyKeyword',
        message: 'Do not assert to any. Give the value a real type, or check it at run time.',
    },
    {
        selector: ':matches(TSAsExpression, TSTypeAssertion) > TSNeverKeyword',
        message: 'Do not assert to never to silence the type system.',
    },
    {
        selector: String.raw`LogicalExpression[operator=/^(\|\||\?\?)$/][right.type="ObjectExpression"][right.properties.length=0]`,
        message: 'An empty-object fallback hides a missing value. Handle the missing case.',
    },
    {
        selector:
            'NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type="ObjectExpression"]) > :matches(Literal.arguments:first-child[value=/^[a-z]/], TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/])',
        message: 'Start an error message with a capital letter.',
    },
    {
        selector:
            'CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name="log"][callee.object.name!="console"]) > TemplateLiteral.arguments:first-child[expressions.length>0]',
        message: 'Log a stable message and pass the values as fields.',
    },
] as const;

export const ESLINT_FUNCTIONS = [
    'buildBlock',
    'readPreset',
    'mergePreset',
    'mergePresetRules',
    'spreadPreset',
    'mergeRuleOptions',
    'setRuleOptions',
    'setLevelRules',
    'addPlugins',
    'setRootFolder',
    'setImportLookup',
    'setBoundaryLookup',
    'setRuntime',
    'setComponentParser',
    'setScriptParser',
    'setJestGlobals',
    'buildRuntimeMatcher',
    'stripRuntimeGlobals',
    'buildComponentMatcher',
    'importAstroPlugin',
    'importSvelteParser',
] as const;

export const IMPORT_NAME_PUNCTUATION = /[{}\s]/gu;

export const ESLINT_PLUGIN_IMPORTERS = new Map([
    ['eslint-plugin-astro', 'importAstroPlugin'],
    ['svelte-eslint-parser', 'importSvelteParser'],
]);

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

const JSX_FILES = ['**/*.{jsx,tsx}'] as const;

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
        calls: [
            { name: 'addPlugins', args: [{ imports: { jest: 'jest' } }] },
            { name: 'setJestGlobals', args: [{ importName: 'jest' }] },
        ],
        fields: { settings: { jest: { globalPackage: JEST_GLOBAL_PACKAGE } } },
        files: 'tests',
        rules: {
            ...Object.fromEntries([...TEST_RULE_NAMES, ...JEST_RULE_NAMES].map((name) => [`jest/${name}`, 'error'])),
            'sonarjs/assertions-in-tests': 'off',
            'jest/valid-expect': ['error', { maxArgs: 1 }],
        },
    },
    expo: {
        imports: CONFIGURATION_PLUGINS.expo,
        calls: [{ name: 'addPlugins', args: [{ imports: { expo: 'expoPlugin' } }] }],
        files: 'code',
        rules: EXPO_RULES,
    },
    express: { imports: {}, calls: [], files: 'code', rules: EXPRESS_RULES },
    'react-native': {
        imports: CONFIGURATION_PLUGINS['react-native'],
        calls: [{ name: 'addPlugins', args: [{ imports: { '@react-native': 'reactNativePlatform' } }] }],
        files: 'code',
        rules: REACT_NATIVE_RULES,
    },
    translations: {
        imports: CONFIGURATION_PLUGINS.translations,
        calls: [{ name: 'addPlugins', args: [{ imports: { i18next: 'i18next' } }] }],
        files: JSX_FILES,
        ignoresTests: true,
        rules: TRANSLATIONS_RULES,
    },
};

export const COMMONJS_FILES = '**/*.{cjs,cts}';

export const ESLINT_BROWSER_CONFIGURATIONS = ['react', 'vue', 'svelte'] as const;
