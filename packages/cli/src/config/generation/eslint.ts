import { JSON_INDENT } from '#cli/config/generation/files.ts';

/** The ESLint runtime helper, which the ESLint tool file imports from its own folder. */
const ESLINT_RUNTIME_FILE = 'eslint-runtime.mjs';

export const ESLINT_RULE_NAMES_FILE = 'configurations/language/javascript/eslint-rule-names.json';
export const ESLINT_RUNTIME_NAMES_FILE = 'configurations/language/javascript/eslint-runtime-names.json';
export const ESLINT_PRESETS_FILE = 'eslint-presets.json';

/** Mise task files use the script runtime and process rules. */
export const MISE_SCRIPT_PATH = '.mise/tasks/**';

// The check that runs ESLint, whose ignores with a rule become blocks of the generated tool file.
export const ESLINT_CHECK = 'javascript/eslint';

/** The default folder boundaries at level all. */
export const ESLINT_BOUNDARY_FOLDERS = ['*/*'] as const;

/** Frameworks whose application sources use browser APIs. Build scripts retain Node.js. */
export const ESLINT_BROWSER_CONFIGURATIONS = ['react', 'vue', 'svelte'] as const;

/** Count require calls and dynamic imports too, and classify imports and exports by their specifiers. */
export const TRPC_DEPENDENCY_NODES = ['require', 'dynamic-import'] as const;

export const TRPC_DEPENDENCY_SELECTORS = [
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

/** Files that no boundary covers stay outside your own architecture policies. */
export const UNKNOWN_IMPORT_POLICIES = [
    { from: { file: { isUnknown: true } }, allow: { to: { file: { path: '**/*' } } } },
    { allow: { to: { file: { isUnknown: true } } } },
] as const;

/** The final policy refuses server values even when your own module rule permits the import. */
/** The boundary category of the files of each import rule, before the name of the rule. */
export const IMPORT_RULE_CATEGORY = 'import-rule:';
export const BOUNDARY_SOURCE_TEMPLATE = '{{dependency.source}}';
export const BOUNDARY_OWNER_TEMPLATE = '{{to.file.categories.[0]}}';
/** A rule name that holds {{ stays text in a boundaries message. */
export const TEMPLATE_OPEN = '{{';
export const TEMPLATE_OPEN_ESCAPED = String.raw`\{{`;
/** The boundary category of the tRPC server files. */
export const TRPC_SERVER_CATEGORY = 'trpc:server';

export const TRPC_SERVER_VALUE_POLICY = {
    from: { file: [{ isUnknown: true }, { categories: { noneOf: [TRPC_SERVER_CATEGORY] } }] },
    disallow: { to: { file: { categories: TRPC_SERVER_CATEGORY } }, dependency: { kind: 'value' } },
} as const;

/** Selectors that cover alias import suffixes next to the relative-import rule. */
export const ALIAS_IMPORT_SELECTORS = {
    always: {
        selector: String.raw`:matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\/)/][source.value!=/\.[^/?.]+$/]:not([source.value=/\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))`,
        message: 'Give an alias import its file extension.',
    },
    never: {
        selector: String.raw`:matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\/)/][source.value=/\.[cm]?[jt]sx?$/]:not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))`,
        message: 'Keep alias imports extensionless in bundled code.',
    },
} as const;

/** Compiled imports use the JavaScript suffix of the output for TypeScript files. */
export const TYPESCRIPT_EXTENSION_MAP = [
    ['.ts', '.js'],
    ['.mts', '.mjs'],
    ['.cts', '.cjs'],
    ['.tsx', '.js'],
] as const;

/** Import resolution finds your own TypeScript modules before it checks output suffixes. */
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

/** Restrict environment reads to the environment readers. */
export const ENVIRONMENT_RULES = {
    'n/no-process-env': ['error', { allowedVariables: ['NODE_ENV'] }],
    'no-restricted-properties': ['error', { object: 'Bun', property: 'env' }, { object: 'Deno', property: 'env' }],
} as const;

export const ENVIRONMENT_SELECTOR = {
    selector:
        'MemberExpression[object.type="MetaProperty"][object.meta.name="import"][object.property.name="meta"][property.name="env"]',
    message:
        'Read environment variables only in the files that structure.environment_readers lists, and pass the value in.',
} as const;

/** Plugins used by the shared JavaScript rule tables. */
export const ESLINT_PLUGIN_IMPORTS = {
    gspot: ['gspot', '@gspothq/eslint-plugin'],
    'import-x': ['importX', 'eslint-plugin-import-x'],
    jsdoc: ['jsdoc', 'eslint-plugin-jsdoc'],
    n: ['nodePlugin', 'eslint-plugin-n'],
    regexp: ['regexp', 'eslint-plugin-regexp'],
    security: ['security', 'eslint-plugin-security'],
} as const;

export const TEST_BOUNDARY_CATEGORY = 'tests';
export const OTHER_BOUNDARY_ELEMENTS = [{ type: 'other', pattern: '**', partialMatch: false }] as const;

export const OTHER_BOUNDARY_FILE = { category: 'other', pattern: ['**/*'] } as const;

export const TEST_IMPORT_POLICY = {
    from: { file: { categories: { noneOf: [TEST_BOUNDARY_CATEGORY] } } },
    disallow: { to: { file: { categories: TEST_BOUNDARY_CATEGORY } } },
} as const;

export const IMPORT_BOUNDARIES_RULE = 'gspot/import-boundaries';
export const EXPORTS_LAST_RULE = 'import-x/exports-last';
export const BARREL_FILES_RULE = 'barrel-files/avoid-barrel-files';
export const IMPORT_LAYOUT_RULES = {
    'import-x/first': 'error',
    'import-x/newline-after-import': ['error', { count: 1, considerComments: true }],
} as const;
export const ESLINT_SETTINGS_TABLE = 'tools.eslint';

export const RESTRICTED_IMPORT_RULES: ReadonlySet<string> = new Set([
    'no-restricted-imports',
    '@typescript-eslint/no-restricted-imports',
]);
export const TRIVIAL_FILES_RULE = 'gspot/no-trivial-files';
export const TRIVIAL_FUNCTIONS_RULE = 'gspot/no-trivial-functions';
export const TRIVIAL_FUNCTION_LIMIT = 'trivial_function_statements';
export const ENVIRONMENT_LANGUAGES = ['javascript', 'typescript', 'vue', 'svelte', 'astro'] as const;
export const TYPED_LANGUAGES = ['typescript', 'vue', 'svelte', 'astro'] as const;
export const FILE_EXTENSION_RULE = 'n/file-extension-in-import';

/** Bundled code drops the suffix of these code modules only; stylesheets, JSON, images, and fonts keep theirs. */
export const EXTENSIONLESS_CODE = { '.js': 'never', '.jsx': 'never', '.ts': 'never', '.tsx': 'never' } as const;

export const ANY_DEPTH_PREFIX = /^\*\*\//u;

export const REGEX_SYMBOLS = /[.*+?^${}()|[\]\\]/gu;

export const PATH_SEPARATOR_PATTERN = String.raw`[\\/]`;

/** Node runs these scripts without a bundler, so their imports keep the full file name. */
export const NODE_SCRIPT_PATTERNS = ['**/*.mjs', '**/*.cjs'] as const;
export const COMPONENT_CONFIGURATIONS = ['vue', 'svelte'] as const;
export const CODE_LANGUAGES = ['javascript', 'typescript'] as const;

/** CommonJS file extensions preserve their module globals. */
export const COMMONJS_FILES = '**/*.{cjs,cts}';

export const ESLINT_TOOL = 'eslint';

export const CODE_PRESETS = [
    ['eslint', 'eslint'],
    ['sonar', 'sonarjs'],
    ['unicorn', 'unicorn'],
] as const;
export const FILE_PRESETS = [
    ['packageJson', 'packageJson'],
    ['prettier', 'prettierConfig'],
] as const;
export const PACKAGE_JSON_PATTERN = '**/package.json';

export const ESLINT_BASE_IMPORTS = [
    [
        '{ root, joinRoot, runtimeMatches, mergePresetRules, stripRuntimeGlobals, vueComponentMatches, svelteComponentMatches }',
        './' + ESLINT_RUNTIME_FILE,
    ],
    ['globals', 'globals'],
] as const;

/** The indent of each generated ESLint block. */
export const ESLINT_INDENT = ' '.repeat(JSON_INDENT);

/** The source label of shared ESLint blocks. */
export const ESLINT_BASE_LABEL = 'JavaScript and repository settings';

export const COMPONENT_MATCHERS = {
    vue: 'vueComponentMatches(vueParser)',
    svelte: 'svelteComponentMatches(svelteParser, tseslint.parser)',
} as const;

export const ESLINT_LIMIT_RULES = {
    'max-lines': { limit: 'file_lines', options: { skipBlankLines: true, skipComments: true } },
    'max-lines-per-function': {
        limit: 'function_lines',
        options: { skipBlankLines: true, skipComments: true, IIFEs: true },
    },
    'max-params': { limit: 'function_parameters', options: { countVoidThis: false } },
    'max-depth': { limit: 'block_nesting' },
    'max-statements': { limit: 'function_statements' },
    'max-nested-callbacks': { limit: 'callback_nesting' },
    complexity: { limit: 'cyclomatic_complexity' },
    'sonarjs/cognitive-complexity': { limit: 'cognitive_complexity' },
} as const;

export const RUNTIME_GLOBALS: Readonly<Record<string, string>> = { node: 'nodeBuiltin', commonjs: 'node' };
export const NODE_RUNTIMES: readonly string[] = ['node', 'nodeBuiltin', 'commonjs'] as const;

/** Plugins loaded by the all level and its permitted barrel exports. */
export const LEVEL_ALL_PLUGIN_IMPORTS = {
    perfectionist: ['perfectionist', 'eslint-plugin-perfectionist'],
    'barrel-files': ['barrelFiles', 'eslint-plugin-barrel-files'],
} as const;

/** The boundaries plugin accompanies emitted dependency policies. */
export const BOUNDARIES_PLUGIN_IMPORT = { boundaries: ['boundaries', 'eslint-plugin-boundaries'] } as const;
