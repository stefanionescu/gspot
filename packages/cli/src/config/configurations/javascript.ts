import type { PluginRuleBlock } from '#cli/types/configurations/language.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/configurations/framework.ts';

export const TSC_UNFORMATTED_OUTPUT = ['--pretty', 'false'] as const;

export const ESLINT_PLUGIN_IMPORTS = {
    gspot: ['gspot', '@gspothq/eslint-plugin'],
    'import-x': ['importX', 'eslint-plugin-import-x'],
    jsdoc: ['jsdoc', 'eslint-plugin-jsdoc'],
    n: ['nodePlugin', 'eslint-plugin-n'],
    regexp: ['regexp', 'eslint-plugin-regexp'],
    security: ['security', 'eslint-plugin-security'],
} as const;

export const LEVEL_ALL_PLUGIN_IMPORTS = {
    perfectionist: ['perfectionist', 'eslint-plugin-perfectionist'],
} as const;

export const BOUNDARIES_PLUGIN_IMPORT = { boundaries: ['boundaries', 'eslint-plugin-boundaries'] } as const;

export const ESLINT_FUNCTIONS_FILE = 'functions.mjs';

export const GLOBALS_IMPORT = ['globals', 'globals'] as const;

export const CONFIGURATION_BLOCKS_SUFFIX = 'Blocks';

export const NAME_HYPHEN = /-(?<letter>[a-z0-9])/gu;

export const ESLINT_BASE_LABEL = 'javascript';

export const ESLINT_SETTINGS_TABLE = 'tools.eslint';

export const COMPONENT_CONFIGURATIONS = ['vue', 'svelte'] as const;

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
            'gspot/require-test-assertions': 'off',
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

export const SUPABASE_RULES = { 'gspot/no-unvalidated-json-body': 'error' } as const;

export const COMMONJS_FILES = '**/*.{cjs,cts}';

export const ESLINT_BROWSER_CONFIGURATIONS = ['react', 'vue', 'svelte'] as const;

export const JAVASCRIPT_BUNDLED_IMPORTS = { module: 'ESNext', moduleResolution: 'Bundler' } as const;

export const JAVASCRIPT_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx'] as const;

export const JAVASCRIPT_IGNORED_GLOBS = [
    '**/eslint.config.mjs',
    '**/eslint.config.js',
    '**/eslint.config.cjs',
] as const;

export const STANDALONE_OPTIONS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
} as const;

export const JAVASCRIPT_OPTIONS = {
    checkJs: true,
    strict: true,
    allowImportingTsExtensions: true,
    maxNodeModuleJsDepth: 0,
} as const;

export const SOURCE_SELECTION_FIELDS = ['files', 'include'] as const;

export const KNIP_JAVASCRIPT_ENTRY_FILES = ['src/main.{ts,js}', 'src/index.{ts,js}'] as const;

export const KNIP_IGNORED_DEPENDENCIES = ['@gspothq/cli'] as const;

export const COMMAND_WORD_SEPARATORS = /[\s;&|()]+/u;

export const PACKAGE_RUNNERS: Readonly<Record<string, readonly string[]>> = {
    bunx: [],
    npx: [],
    bun: ['x'],
    npm: ['exec'],
    pnpm: ['exec', 'dlx'],
    yarn: ['exec', 'dlx'],
};

export const MISE_FILE_TASK_GLOBS = [
    '**/mise-tasks/**',
    '**/.mise-tasks/**',
    '**/mise/tasks/**',
    '**/.mise/tasks/**',
    '**/.config/mise/tasks/**',
] as const;

export const KNIP_ESLINT_CONFIG = 'eslint.config.mjs';

export const KNIP_TABLE = 'tools.knip';

export const KNIP_CHECK = 'javascript/knip';

export const BIOME_TYPESCRIPT_FILES = ['**/*.{ts,tsx,mts,cts,astro,vue,svelte}'];

export const UNQUOTED_COMMENT = /('[^']*'|"(?:[^"\\]|\\.)*")|(?<![^\s;&|()])#.*/gu;

export const JAVASCRIPT_TSC_COMMAND = ['tsc', '-p'] as const;

export const JSCONFIG_TSBUILDINFO = 'jsconfig.check.tsbuildinfo';

export const NEXTJS_CONFIGURATION = 'nextjs';
