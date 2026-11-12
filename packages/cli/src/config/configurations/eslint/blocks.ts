import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import type { SelectorPaths } from '#cli/types/configurations/javascript.ts';

export const GSPOT_PRESET_LEVELS = { basic: 'recommended', all: 'all' } as const;

export const IMPORT_LAYOUT_RULES = {
    'import-x/first': 'error',
    'import-x/newline-after-import': ['error', { count: 1, considerComments: true }],
} as const;

export const RUNTIME_GLOBALS: Readonly<Record<string, string>> = { node: 'nodeBuiltin', commonjs: 'node' };

export const NODE_RUNTIMES: readonly string[] = ['node', 'nodeBuiltin', 'commonjs'];

export const TEST_RULES = {
    'n/no-unpublished-import': 'off',
    'n/no-unpublished-require': 'off',
    'no-template-curly-in-string': 'off',
    'unicorn/no-incorrect-template-string-interpolation': 'off',
} as const;

export const ROOT_PACKAGE_JSON_RULES = { 'package-json/require-packageManager': 'error' } as const;

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
    'n/hashbang': 'error',
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

export const IMPORT_BOUNDARIES_RULE = 'gspot/import-boundaries';

export const PACKAGE_JSON_PATTERN = '**/package.json';

export const PIN_RANGES_RULE = 'package-json/restrict-dependency-ranges';

const SCRIPT_NAMES_RULE = 'package-json/scripts-name-casing';

const PUBLISHED_PIN_OPTIONS = { forDependencyTypes: ['devDependencies'], rangeType: 'pin' } as const;

export const PACKAGE_JSON_RULES = {
    [PIN_RANGES_RULE]: ['error', PUBLISHED_PIN_OPTIONS],
    [SCRIPT_NAMES_RULE]: 'error',
    'package-json/valid-contributors': 'off',
} as const;

export const PRIVATE_PIN_OPTIONS = { rangeType: 'pin' } as const;

export const GSPOT_RULE_PREFIX = 'gspot/';

export const BOUNDARIES_FILES_SETTING = 'boundaries/files';

export const TEST_BOUNDARY_CATEGORY = 'tests';

export const OTHER_BOUNDARY_ELEMENTS = [{ type: 'other', pattern: '**', partialMatch: false }] as const;

export const TEST_IMPORT_POLICY = {
    from: { file: { categories: { noneOf: [TEST_BOUNDARY_CATEGORY] } } },
    disallow: { to: { file: { categories: TEST_BOUNDARY_CATEGORY } } },
} as const;

export const OTHER_BOUNDARY_FILE = { category: 'other', pattern: ['**/*'] } as const;

export const TRPC_SERVER_CATEGORY = 'trpc:server';

export const TRPC_SERVER_VALUE_POLICY = {
    from: { file: [{ isUnknown: true }, { categories: { noneOf: [TRPC_SERVER_CATEGORY] } }] },
    disallow: { to: { file: { categories: TRPC_SERVER_CATEGORY } }, dependency: { kind: 'value' } },
} as const;

export const TEMPLATE_OPEN_ESCAPED = String.raw`\{{`;

export const TEMPLATE_OPEN = '{{';

export const BOUNDARY_OWNER_TEMPLATE = '{{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}';

export const BOUNDARY_SOURCE_TEMPLATE = '{{dependency.source}}';

export const UNKNOWN_IMPORT_POLICIES = [
    { from: { file: { isUnknown: true } }, allow: { to: { file: { path: '**/*' } } } },
    { allow: { to: { file: { isUnknown: true } } } },
] as const;

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

export const BOUNDARY_DEPENDENCY_NODES = ['require', 'dynamic-import'] as const;

export const NODE_SCRIPT_PATTERNS = ['**/*.mjs', '**/*.cjs'] as const;

export const REGEX_SYMBOLS = /[.*+?^${}()|[\]\\]/gu;

export const ANY_DEPTH_PREFIX = /^\*\*\//u;

export const EXTENSIONLESS_CODE = { '.js': 'never', '.jsx': 'never', '.ts': 'never', '.tsx': 'never' } as const;

export const FILE_EXTENSION_RULE = 'n/file-extension-in-import';

export const DENO_IMPORT_EXTENSION = 'ts';

export const DEFAULT_PROJECT_FILES = ['**/*.config.{ts,mts,cts}', '**/scripts/*.ts'] as const;

export const DEFAULT_PROJECT_FILE_LIMIT = 8;

export const DEFAULT_PROJECT_LIMIT_OPTION = 'maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING';

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

export const TYPESCRIPT_EXTENSION_MAP = [
    ['.ts', '.js'],
    ['.mts', '.mjs'],
    ['.cts', '.cjs'],
    ['.tsx', '.js'],
] as const;

export const IMPORT_BOUNDARY_FOLDERS = ['*/*'] as const;

export const ESLINT_LIMIT_OPTIONS: Readonly<Record<string, Readonly<Record<string, boolean | string>>>> = {
    'max-lines': { skipBlankLines: true, skipComments: true },
    'max-lines-per-function': { skipBlankLines: true, skipComments: true, IIFEs: true },
    'max-params': {},
    'max-depth': {},
    'max-statements': {},
    'max-nested-callbacks': {},
    complexity: { variant: 'modified' },
};

export const ENVIRONMENT_SELECTOR = {
    selector:
        'MemberExpression[object.type="MetaProperty"][object.meta.name="import"][object.property.name="meta"][property.name="env"]',
    message:
        'Read environment variables only in the files that structure.environment_readers lists, and pass the value in.',
} as const;

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

export const TYPED_LANGUAGES = ['typescript', 'vue', 'svelte', 'astro'] as const;

export const ENVIRONMENT_LANGUAGES = ['javascript', 'typescript', 'vue', 'svelte', 'astro'] as const;

export const TRIVIAL_FUNCTIONS_RULE = 'gspot/no-trivial-functions';

export const TRIVIAL_FILES_RULE = 'gspot/no-trivial-files';

export const CLIENT_ENVIRONMENT_RULE = 'gspot/no-client-environment';

export const RESTRICTED_SYNTAX_RULE = 'gspot/restricted-syntax';

export const ENVIRONMENT_RULES = {
    'n/no-process-env': ['error', { allowedVariables: ['NODE_ENV'] }],
    'no-restricted-properties': ['error', { object: 'Bun', property: 'env' }, { object: 'Deno', property: 'env' }],
} as const;

export const PACKAGE_JSON_RULE_PREFIX = 'package-json/';

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

export const ESLINT_CHECK = 'javascript/eslint';

export const ESLINT_INDENT = ' '.repeat(JSON_INDENT);

export const CODE_LANGUAGES = ['javascript', 'typescript'] as const;

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

export const PATH_SEPARATOR_PATTERN = String.raw`[/\\]`;

export const TRPC_CONFIGURATION = 'trpc';
