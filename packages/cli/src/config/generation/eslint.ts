import type { EslintBoundaryPolicy, EslintDependencyNode } from '#cli/types/generation/eslint.ts';

/** Mise task files use the script runtime and process rules. */
export const MISE_SCRIPT_PATH = '.mise/tasks/**';

/** The core catalog shares the preset producer and exact tool pin. */
export const ESLINT_RULE_NAMES_FILE = 'configurations/language/javascript/eslint-rule-names.json';
export const ESLINT_RULE_NAMES_MODULE = 'eslint/use-at-your-own-risk';

/** Runtime names captured from the declared native globals package. */
export const ESLINT_RUNTIME_NAMES_FILE = 'configurations/language/javascript/runtime-names.json';
export const ESLINT_RUNTIME_NAMES_MODULE = 'globals';

/** Test correctness rules shared by the two native test plugins, without their namespace. */
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
];

// Shared ESLint data comes from the JavaScript configuration's shipped assets.

// The check that runs ESLint, whose ignores with a rule become blocks of the generated tool file.
export const LINT_CHECK = 'javascript/eslint';

/** Default folder boundaries selected by all-level repository policy. */
export const ESLINT_BOUNDARY_FOLDERS = ['*/*'];

// The limits the generated ESLint configuration reads, by the name it gives each one.
export const ESLINT_LIMITS: Record<string, string> = {
    fileLines: 'file_lines',
    functionLines: 'function_lines',
    parameters: 'function_parameters',
    cyclomatic: 'cyclomatic_complexity',
    cognitive: 'cognitive_complexity',
    depth: 'nesting',
    statements: 'statements',
    nestedCallbacks: 'callback_nesting',
    indexExports: 'index_exports',
};

// The limits JavaScript files read on their own, over the TypeScript ones.
export const ESLINT_JAVASCRIPT_LIMITS: Record<string, string> = {
    parameters: 'function_parameters',
};

/** Role precedence keeps test support and type declarations outside the runtime layer. */
export const ROLE_ORDER = ['test_harness', 'tests', 'types', 'env', 'config', 'runtime'] as const;

/** Role policies use file categories independently of declared module identities. */
export const ROLE_IMPORT_POLICIES: EslintBoundaryPolicy[] = [
    {
        from: { file: { categories: 'role:types' } },
        disallow: { to: { file: { categories: { noneOf: ['role:types'] } } }, dependency: { kind: 'value' } },
    },
    {
        from: { file: { categories: 'role:runtime' } },
        disallow: { to: { file: { categories: { anyOf: ['role:tests', 'role:test_harness'] } } } },
    },
    {
        from: { file: { categories: { anyOf: ['role:tests', 'role:test_harness'] } } },
        disallow: {
            to: { file: { categories: 'role:runtime', path: '**/!(public|contracts).*' } },
            dependency: { kind: 'value' },
        },
    },
    {
        from: { file: { categories: { anyOf: ['role:config', 'role:env'] } } },
        disallow: { to: { file: { categories: 'role:runtime' } }, dependency: { kind: 'value' } },
    },
];

/** Frameworks whose application sources use browser APIs. Build scripts retain Node.js. */
export const ESLINT_BROWSER_CONFIGURATIONS = ['react', 'vue', 'svelte', 'vite'];

/** Keep native calls while classifying import and export types by their actual specifiers. */
export const TRPC_DEPENDENCY_NODES = ['require', 'dynamic-import'];

export const TRPC_DEPENDENCY_SELECTORS: EslintDependencyNode[] = [
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
];

/** Native boundary classification leaves unknown clients outside authored architecture policies. */
export const TRPC_UNKNOWN_IMPORT_POLICIES: EslintBoundaryPolicy[] = [
    { from: { file: { isUnknown: true } }, allow: { to: { file: { path: '**/*' } } } },
    { allow: { to: { file: { isUnknown: true } } } },
];

/** The final native policy refuses server values even when an authored edge permits the import. */
export const TRPC_SERVER_VALUE_POLICY: EslintBoundaryPolicy = {
    from: { file: [{ isUnknown: true }, { categories: { noneOf: ['module:server'] } }] },
    disallow: { to: { file: { categories: 'module:server' } }, dependency: { kind: 'value' } },
};

/** Native selectors cover alias import suffixes alongside the relative-import rule. */
export const ALIAS_IMPORT_SELECTORS = {
    always: {
        selector: String.raw`:matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\/)/][source.value!=/\.[^/?.]+$/]:not([source.value=/\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))`,
        message: 'Give an alias import its file extension.',
    },
    never: {
        selector: String.raw`:matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\/)/][source.value=/\.[cm]?[jt]sx?$/]:not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))`,
        message: 'Keep alias imports extensionless in bundled code.',
    },
};

/** Native compiled imports use the emitted JavaScript suffix for TypeScript sources. */
export const TYPESCRIPT_EXTENSION_MAP = [
    ['.ts', '.js'],
    ['.mts', '.mjs'],
    ['.cts', '.cjs'],
    ['.tsx', '.js'],
] as const;

/** Native import resolution includes authored TypeScript modules before checking emitted suffixes. */
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

/** Native environment reads are restricted outside the architecture role. */
export const ENVIRONMENT_RULES = {
    'n/no-process-env': ['error', { allowedVariables: ['NODE_ENV'] }],
    'no-restricted-properties': ['error', { object: 'Bun', property: 'env' }, { object: 'Deno', property: 'env' }],
};

export const ENVIRONMENT_SELECTOR = {
    selector:
        'MemberExpression[object.type="MetaProperty"][object.meta.name="import"][object.property.name="meta"][property.name="env"]',
    message: 'Read the environment in its architecture owner and pass the value to other modules.',
};
