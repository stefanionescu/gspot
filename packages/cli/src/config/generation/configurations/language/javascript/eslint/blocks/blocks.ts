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

export const BOUNDARY_OWNER_TEMPLATE = '{{to.file.categories.[0]}}';

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

export const IMPORT_RULE_CATEGORY = 'import-rule:';

export const NODE_SCRIPT_PATTERNS = ['**/*.mjs', '**/*.cjs'] as const;

export const REGEX_SYMBOLS = /[.*+?^${}()|[\]\\]/gu;

export const ANY_DEPTH_PREFIX = /^\*\*\//u;

export const EXTENSIONLESS_CODE = { '.js': 'never', '.jsx': 'never', '.ts': 'never', '.tsx': 'never' } as const;

export const FILE_EXTENSION_RULE = 'n/file-extension-in-import';

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

export const BARREL_FILES_RULE = 'barrel-files/avoid-barrel-files';

export const ESLINT_LIMIT_RULES = {
    'max-lines': { limit: 'file_lines', options: { skipBlankLines: true, skipComments: true } },
    'max-lines-per-function': {
        limit: 'function_lines',
        options: { skipBlankLines: true, skipComments: true, IIFEs: true },
    },
    'max-params': { limit: 'function_parameters' },
    'max-depth': { limit: 'block_nesting' },
    'max-statements': { limit: 'function_statements' },
    'max-nested-callbacks': { limit: 'callback_nesting' },
    complexity: { limit: 'cyclomatic_complexity' },
    'sonarjs/cognitive-complexity': { limit: 'cognitive_complexity' },
} as const;

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

export const REEXPORT_SELECTORS = ['ExportAllDeclaration', 'ExportNamedDeclaration[source!=null]'] as const;

export const REEXPORT_MESSAGE = 'Export values at their declaration instead of re-exporting them.';

export const INDEX_PATTERN = '**/index.*';

export const TYPED_LANGUAGES = ['typescript', 'vue', 'svelte', 'astro'] as const;

export const ENVIRONMENT_LANGUAGES = ['javascript', 'typescript', 'vue', 'svelte', 'astro'] as const;

export const TRIVIAL_FUNCTION_LIMIT = 'trivial_function_statements';

export const TRIVIAL_FUNCTIONS_RULE = 'gspot/no-trivial-functions';

export const TRIVIAL_FILES_RULE = 'gspot/no-trivial-files';

export const ENVIRONMENT_RULES = {
    'n/no-process-env': ['error', { allowedVariables: ['NODE_ENV'] }],
    'no-restricted-properties': ['error', { object: 'Bun', property: 'env' }, { object: 'Deno', property: 'env' }],
} as const;

export const PACKAGE_JSON_RULE_PREFIX = 'package-json/';
