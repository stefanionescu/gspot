import { REACT_FILES } from '#cli/config/configurations/shared.ts';
import { VAGUE_TEST_TITLE_WORDS } from '#cli/config/configurations/testing.ts';
import type { PluginRuleBlock, SelectorPaths } from '#cli/types/configurations/javascript.ts';

// package-json block
export const PACKAGE_JSON_PATTERN = '**/package.json';
export const PRIVATE_PIN_OPTIONS = { rangeType: 'pin' } as const;

// base block
export const BOUNDARIES_FILES_SETTING = 'boundaries/files';
export const GSPOT_RULE_PREFIX = 'gspot/';
export const IMPORT_BOUNDARIES_RULE = 'gspot/import-boundaries';
export const PRESETS_AFTER_CONFIGURATIONS = [
    {
        package: 'eslint-plugin-package-json',
        path: 'configs.recommended',
        files: [PACKAGE_JSON_PATTERN],
    },
    { package: 'eslint-config-prettier' },
] as const;
export const PRESETS_BEFORE_CONFIGURATIONS = [
    { package: '@eslint/js', path: 'configs.recommended' },
    {
        package: 'eslint-plugin-unicorn',
        path: 'configs.unopinionated',
        allPath: 'configs.recommended',
    },
] as const;
export const RESTRICTED_SYNTAX_RULE = 'gspot/restricted-syntax';

// boundaries block
export const BOUNDARY_DEPENDENCY_NODES = ['require', 'dynamic-import'] as const;
export const BOUNDARY_DEPENDENCY_SELECTORS = [
    {
        selector:
            'ImportDeclaration:not([importKind=type]):matches([specifiers.length=0], :has(ImportSpecifier:not([importKind=type]), ImportDefaultSpecifier, ImportNamespaceSpecifier)) > Literal',
        kind: 'value',
        name: 'import',
    },
    {
        selector:
            'ImportDeclaration:matches([importKind=type], [specifiers.length>0]:not(:has(ImportSpecifier:not([importKind=type]), ImportDefaultSpecifier, ImportNamespaceSpecifier))) > Literal',
        kind: 'type',
        name: 'import',
    },
    {
        selector:
            ':matches(ExportAllDeclaration:not([exportKind=type]), ExportNamedDeclaration:not([exportKind=type]):matches([specifiers.length=0], :has(ExportSpecifier:not([exportKind=type])))) > Literal',
        kind: 'value',
        name: 'export',
    },
    {
        selector:
            ':matches(ExportAllDeclaration[exportKind=type], ExportNamedDeclaration:matches([exportKind=type], [specifiers.length>0]:not(:has(ExportSpecifier:not([exportKind=type]))))) > Literal',
        kind: 'type',
        name: 'export',
    },
] as const;
export const BOUNDARY_OWNER_TEMPLATE = '{{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}';
export const BOUNDARY_SOURCE_TEMPLATE = '{{dependency.source}}';
export const OTHER_BOUNDARY_ELEMENTS = [{ type: 'other', pattern: '**', partialMatch: false }] as const;
export const OTHER_BOUNDARY_FILE = { category: 'other', pattern: ['**/*'] } as const;
export const TEMPLATE_OPEN = '{{';
export const TEMPLATE_OPEN_ESCAPED = String.raw`\{{`;
export const TEST_BOUNDARY_CATEGORY = 'tests';
export const TEST_IMPORT_POLICY = {
    from: { file: { categories: { noneOf: [TEST_BOUNDARY_CATEGORY] } } },
    disallow: { to: { file: { categories: TEST_BOUNDARY_CATEGORY } } },
} as const;
export const TRPC_SERVER_CATEGORY = 'trpc:server';
export const TRPC_SERVER_VALUE_POLICY = {
    from: { file: [{ isUnknown: true }, { categories: { noneOf: [TRPC_SERVER_CATEGORY] } }] },
    disallow: { to: { file: { categories: TRPC_SERVER_CATEGORY } }, dependency: { kind: 'value' } },
} as const;
export const UNKNOWN_IMPORT_POLICIES = [
    { from: { file: { isUnknown: true } }, allow: { to: { file: { path: '**/*' } } } },
    { allow: { to: { file: { isUnknown: true } } } },
] as const;

// configurations block
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

// imports block
export const ANY_DEPTH_PREFIX = /^\*\*\//u;
export const DENO_IMPORT_EXTENSION = 'ts';
export const EXTENSIONLESS_CODE = { '.js': 'never', '.jsx': 'never', '.ts': 'never', '.tsx': 'never' } as const;
export const FILE_EXTENSION_RULE = 'n/file-extension-in-import';
export const IMPORT_BOUNDARY_FOLDERS = ['*/*'] as const;
export const IMPORT_EXTENSIONS = [
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.mjs',
    '.mts',
    '.cjs',
    '.cts',
    '.json',
    '.node',
] as const;
export const NODE_SCRIPT_PATTERNS = ['**/*.mjs', '**/*.cjs'] as const;
export const TYPESCRIPT_EXTENSION_MAP = [
    ['.ts', '.js'],
    ['.mts', '.mjs'],
    ['.cts', '.cjs'],
    ['.tsx', '.js'],
] as const;

// limits block
export const ESLINT_LIMIT_OPTIONS: Readonly<Record<string, Readonly<Record<string, boolean | string>>>> = {
    'max-lines': { skipBlankLines: true, skipComments: true },
    'max-lines-per-function': { skipBlankLines: true, skipComments: true, IIFEs: true },
    'max-params': {},
    'max-depth': {},
    'max-statements': {},
    'max-nested-callbacks': {},
    complexity: { variant: 'modified' },
};

// manifests block
export const CLIENT_ENVIRONMENT_RULE = 'gspot/no-client-environment';

// runtimes block
export const COMMONJS_FILES = '**/*.{cjs,cts}';
export const COMMONJS_PACKAGE_TYPE = 'commonjs';
export const ESLINT_BROWSER_CONFIGURATIONS = ['react', 'vue', 'svelte'] as const;
export const NODE_RUNTIMES: readonly string[] = ['node', 'nodeBuiltin', 'commonjs'];
export const RUNTIME_GLOBALS: Readonly<Record<string, string>> = { node: 'nodeBuiltin', commonjs: 'node' };
export const TYPELESS_JAVASCRIPT_FILES = '**/*.{js,jsx}';

// selectors block
export const ALIAS_IMPORT_SELECTORS = {
    always: {
        selector: String.raw`:matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\/|@\/)/][source.value!=/\.[^/?.]+$/]:not([source.value=/\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))`,
        message: 'Give an alias import its file extension.',
    },
    never: {
        selector: String.raw`:matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\/|@\/)/][source.value=/\.[cm]?[jt]sx?$/]:not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))`,
        message: 'Keep alias imports extensionless in bundled code.',
    },
} as const;
export const BASE_SELECTORS: readonly SelectorPaths[] = [
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
        selector: ':matches(TSAsExpression, TSTypeAssertion) > TSNeverKeyword',
        message: 'Do not assert to never to silence the type system.',
    },
    {
        selector:
            'Program:has(> :matches(ExportNamedDeclaration:not([exportKind="type"]), ExportDefaultDeclaration, ExportAllDeclaration:not([exportKind="type"]))) > :matches(ForStatement, ForOfStatement, ForInStatement, WhileStatement, DoWhileStatement, IfStatement, TryStatement)',
        message:
            'A module that exports values runs no statements when it loads. Move this statement into a function that the entry point calls.',
        ignores: ['**/*.config.*'],
    },
    {
        selector:
            'NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type="ObjectExpression"]) > :matches(Literal.arguments:first-child[value=/^[a-z]/], TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/])',
        message: 'Start an error message with a capital letter.',
    },
];
export const ENVIRONMENT_SELECTOR = {
    selector:
        'MemberExpression[object.type="MetaProperty"][object.meta.name="import"][object.property.name="meta"][property.name="env"]',
    message:
        'Read environment variables only in the files that structure.environment_readers lists, and pass the value in.',
} as const;

// settings block
export const PACKAGE_JSON_RULE_PREFIX = 'package-json/';

// structure block
export const ENVIRONMENT_LANGUAGES = ['javascript', 'typescript', 'vue', 'svelte', 'astro'] as const;
export const TRIVIAL_FILES_RULE = 'gspot/no-trivial-files';
export const TRIVIAL_FUNCTIONS_RULE = 'gspot/no-trivial-functions';
export const TYPED_LANGUAGES = ['typescript', 'vue', 'svelte', 'astro'] as const;
