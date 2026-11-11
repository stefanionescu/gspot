import { REACT_FILES, REACT_RULES } from '#cli/config/configurations/framework.ts';
import type { PluginRuleBlock } from '#cli/types/configurations/language.ts';

export const TSC_UNFORMATTED_OUTPUT = ['--pretty', 'false'] as const;

export const ESLINT_PLUGIN_PACKAGES = [
    '@gspothq/eslint-plugin',
    'eslint-plugin-import-x',
    'eslint-plugin-jsdoc',
    'eslint-plugin-n',
    'eslint-plugin-regexp',
    'eslint-plugin-security',
] as const;

export const LEVEL_ALL_PLUGIN_PACKAGE = 'eslint-plugin-perfectionist';

export const BOUNDARIES_PLUGIN_PACKAGE = 'eslint-plugin-boundaries';

export const ESLINT_FUNCTIONS_FILE = 'functions.mjs';

export const CONFIGURATION_BLOCKS_SUFFIX = 'Blocks';

export const PACKAGE_SCOPE_MARK = /^@/u;

export const NAME_SEPARATOR = /[-/.](?<letter>[a-z0-9])/gu;

export const ESLINT_BASE_LABEL = 'javascript';

export const ESLINT_SETTINGS_TABLE = 'tools.eslint';

export const COMPONENT_CONFIGURATIONS = ['vue', 'svelte'] as const;

export const ESLINT_PACKAGE_IMPORTERS: Readonly<Record<string, string | undefined>> = {
    'eslint-plugin-astro': 'importAstroPlugin',
    'svelte-eslint-parser': 'importSvelteParser',
};

export const SHARED_LIST_MARK = '@shared:';

export const SHARED_LIST_REFERENCE = /"@shared:(?<name>\w+)"/gu;

export const ESLINT_RUNTIMES_CONSTANT = 'runtimeDeclarations';

export const BOUNDARY_FOLDERS_CONSTANT = 'importBoundaryFolders';

export const ESLINT_CONFIG_API = 'eslint/config';

export const ESLINT_NAMED_IMPORTS: Readonly<Record<string, string | undefined>> = {
    'eslint-import-resolver-typescript': 'createTypeScriptImportResolver',
    [ESLINT_CONFIG_API]: 'defineConfig',
};

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

const ZOD_RULES = {
    'zod/consistent-import': ['error', { syntax: 'named' }],
    'zod/prefer-strict-object': 'error',
    'zod/prefer-meta-last': 'error',
} as const;

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

export const SUPABASE_RULES = { 'gspot/no-unvalidated-json-body': 'error' } as const;

export const COMMONJS_FILES = '**/*.{cjs,cts}';

export const TYPELESS_JAVASCRIPT_FILES = '**/*.{js,jsx}';

export const COMMONJS_PACKAGE_TYPE = 'commonjs';

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

export const KNIP_JAVASCRIPT_ENTRY_FILES = [
    '{index,cli,main}.{js,mjs,cjs,jsx,ts,tsx,mts,cts}',
    'src/{index,cli,main}.{js,mjs,cjs,jsx,ts,tsx,mts,cts}',
] as const;

export const HIDDEN_FILE_GLOB = /^\.[^.]+(?:\.\*)?$/u;

export const KNIP_IGNORED_DEPENDENCIES = ['@gspothq/cli'] as const;

export const PACKAGE_RUNNERS: Readonly<Record<string, readonly string[]>> = {
    bunx: [],
    npx: [],
    bun: ['x'],
    npm: ['exec'],
    pnpm: ['exec', 'dlx'],
    yarn: ['exec', 'dlx'],
};

export const KNIP_ESLINT_CONFIG = 'eslint.config.mjs';

export const KNIP_CHECK = 'javascript/knip';

export const BIOME_TYPESCRIPT_FILES = ['**/*.{ts,tsx,mts,cts,astro,vue,svelte}'];

export const UNQUOTED_COMMENT = /('[^']*'|"(?:[^"\\]|\\.)*")|(?<![^\s;&|()])#.*/gu;

export const JAVASCRIPT_TSC_COMMAND = ['tsc', '-p'] as const;

export const JSCONFIG_TSBUILDINFO = 'jsconfig.check.tsbuildinfo';

export const NEXTJS_CONFIGURATION = 'nextjs';
