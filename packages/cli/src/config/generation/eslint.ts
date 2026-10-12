export const ESLINT_PRESETS_FILE = 'eslint-presets.json';
export const BUILTIN_RULES_SOURCE = 'builtinRules';

/** Mise task files use the script runtime and process rules. */
export const MISE_SCRIPT_PATH = '.mise/tasks/**';

/** Test correctness rules shared by the two test plugins, without their namespace. */
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

// Shared ESLint data comes from the JavaScript configuration's shipped assets.

// The check that runs ESLint, whose ignores with a rule become blocks of the generated tool file.
export const ESLINT_CHECK = 'javascript/eslint';

/** Default folder boundaries selected by all-level repository policy. */
export const ESLINT_BOUNDARY_FOLDERS = ['*/*'] as const;

/** Frameworks whose application sources use browser APIs. Build scripts retain Node.js. */
export const ESLINT_BROWSER_CONFIGURATIONS = ['react', 'vue', 'svelte'] as const;

/** Keep calls while classifying import and export types by their actual specifiers. */
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

/** Boundary classification leaves unknown clients outside your own architecture policies. */
export const UNKNOWN_IMPORT_POLICIES = [
    { from: { file: { isUnknown: true } }, allow: { to: { file: { path: '**/*' } } } },
    { allow: { to: { file: { isUnknown: true } } } },
] as const;

/** The final policy refuses server values even when your own module rule permits the import. */
export const TRPC_SERVER_VALUE_POLICY = {
    from: { file: [{ isUnknown: true }, { categories: { noneOf: ['module:server'] } }] },
    disallow: { to: { file: { categories: 'module:server' } }, dependency: { kind: 'value' } },
} as const;

/** selectors cover alias import suffixes alongside the relative-import rule. */
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

/** compiled imports use the emitted JavaScript suffix for TypeScript sources. */
export const TYPESCRIPT_EXTENSION_MAP = [
    ['.ts', '.js'],
    ['.mts', '.mjs'],
    ['.cts', '.cjs'],
    ['.tsx', '.js'],
] as const;

/** Import resolution includes your own TypeScript modules before checking emitted suffixes. */
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

/** Restrict environment reads to their declared architecture role. */
export const ENVIRONMENT_RULES = {
    'n/no-process-env': ['error', { allowedVariables: ['NODE_ENV'] }],
    'no-restricted-properties': ['error', { object: 'Bun', property: 'env' }, { object: 'Deno', property: 'env' }],
} as const;

export const ENVIRONMENT_SELECTOR = {
    selector:
        'MemberExpression[object.type="MetaProperty"][object.meta.name="import"][object.property.name="meta"][property.name="env"]',
    message: 'Read the environment in its architecture owner and pass the value to other modules.',
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

export const OTHER_BOUNDARY_FILE = { category: 'other', pattern: ['**/*'] } as const;

export const TEST_IMPORT_POLICY = {
    from: { file: { categories: { noneOf: ['tests'] } } },
    disallow: { to: { file: { categories: 'tests' } } },
} as const;

export const TRPC_CONFIGURATION = 'trpc';
export const TRPC_SERVER_MODULE = 'server';
export const IMPORT_BOUNDARIES_RULE = 'gspot/import-boundaries';
export const EXPORTS_LAST_RULE = 'import-x/exports-last';
export const BARREL_FILES_RULE = 'barrel-files/avoid-barrel-files';
export const IMPORT_LAYOUT_RULES = {
    'import-x/first': 'error',
    'import-x/newline-after-import': ['error', { count: 1 }],
} as const;
export const ESLINT_SETTINGS_TABLE = 'tools.eslint';
export const NODE_SHEBANG_TAG = 'shebang:node';
export const TRIVIAL_FILES_RULE = 'gspot/no-trivial-files';
export const TRIVIAL_FUNCTIONS_RULE = 'gspot/no-trivial-functions';
export const TRIVIAL_FUNCTION_LIMIT = 'min_function_statements';
export const DEFAULT_TRIVIAL_FUNCTION_LIMIT = 2;
export const ENVIRONMENT_LANGUAGES = ['javascript', 'typescript', 'vue', 'svelte', 'astro'] as const;
export const TYPED_LANGUAGES = ['typescript', 'vue', 'svelte', 'astro'] as const;
export const FILE_EXTENSION_RULE = 'n/file-extension-in-import';
export const COMPONENT_CONFIGURATIONS = ['vue', 'svelte'] as const;
export const CODE_LANGUAGES = ['javascript', 'typescript'] as const;

/** Build-derived plugin rule levels, with no copied source preset. */
export const ESLINT_RULE_LEVELS_FILE = 'dist/eslint-rule-levels.json';

/** CommonJS file extensions preserve their module globals. */
export const COMMONJS_FILES = '**/*.{cjs,cts}';

export const REACT_NATIVE_CONFIGURATION = 'react-native';
export const NEXTJS_CONFIGURATION = 'nextjs';
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
    ['{ join, relative, sep }', 'node:path'],
    ['{ readFileSync }', 'node:fs'],
    ['{ fileURLToPath }', 'node:url'],
    ['eslint', '@eslint/js'],
    ['sonarjs', 'eslint-plugin-sonarjs'],
    ['unicorn', 'eslint-plugin-unicorn'],
    ['packageJson', 'eslint-plugin-package-json'],
    ['prettierConfig', 'eslint-config-prettier'],
    ['globals', 'globals'],
    ['picomatch', 'picomatch'],
] as const;
