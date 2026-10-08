import type { EslintPresetSources, EslintBoundaryPolicy, EslintDependencyNode } from '#cli/types/generation/eslint.ts';

/** Mise task files use the script runtime and process rules. */
export const MISE_SCRIPT_PATH = '.mise/tasks/**';

/** The core catalog shares the preset producer and exact tool pin. */
export const ESLINT_RULE_NAMES_FILE = 'configurations/language/javascript/eslint-rule-names.json';
export const ESLINT_RULE_NAMES_MODULE = 'eslint/use-at-your-own-risk';

/** Installed preset sources whose rule and file data is shipped with its owning configuration. */
export const ESLINT_PRESET_SOURCES: EslintPresetSources = {
    javascript: {
        eslint: ['@eslint/js', 'configs.recommended'],
        sonar: ['eslint-plugin-sonarjs', 'configs.recommended'],
        unicorn: ['eslint-plugin-unicorn', 'configs.recommended'],
        packageJson: ['eslint-plugin-package-json', 'configs.recommended'],
        prettier: ['eslint-config-prettier', ''],
        gspot: ['@gspothq/eslint-plugin', 'configs.recommended'],
    },
    typescript: {
        strict: ['typescript-eslint', 'configs.strictTypeChecked'],
        untyped: ['typescript-eslint', 'configs.disableTypeChecked'],
    },
    react: {
        recommended: ['eslint-plugin-react', 'configs.flat.recommended'],
        jsx: ['eslint-plugin-react', 'configs.flat.jsx-runtime'],
        hooks: ['eslint-plugin-react-hooks', 'configs.flat.recommended-latest'],
        refresh: ['eslint-plugin-react-refresh', 'configs.recommended'],
        testing: ['eslint-plugin-testing-library', 'configs.flat/react'],
    },
    'react-dom': { accessibility: ['eslint-plugin-jsx-a11y', 'flatConfigs.recommended'] },
    vue: {
        recommended: ['eslint-plugin-vue', 'configs.flat/recommended'],
        accessibility: ['eslint-plugin-vuejs-accessibility', 'configs.flat/recommended'],
        testing: ['eslint-plugin-testing-library', 'configs.flat/vue'],
    },
    svelte: {
        recommended: ['eslint-plugin-svelte', 'configs.recommended'],
        testing: ['eslint-plugin-testing-library', 'configs.flat/svelte'],
    },
    astro: {
        recommended: ['eslint-plugin-astro', 'configs.flat/recommended'],
        accessibility: ['eslint-plugin-astro', 'configs.flat/jsx-a11y-recommended'],
    },
    nextjs: {
        recommended: ['@next/eslint-plugin-next', 'configs.core-web-vitals'],
        refresh: ['eslint-plugin-react-refresh', 'configs.next'],
    },
    nestjs: {
        recommended: ['@darraghor/eslint-plugin-nestjs-typed', 'configs.flatRecommended'],
        noSwagger: ['@darraghor/eslint-plugin-nestjs-typed', 'configs.flatNoSwagger'],
    },
    'tanstack-query': { recommended: ['@tanstack/eslint-plugin-query', 'configs.flat/recommended'] },
    vitest: { recommended: ['@vitest/eslint-plugin', 'configs.recommended'] },
};

// Shared ESLint data comes from the JavaScript configuration's shipped assets.

// The check that runs ESLint, whose ignores with a rule become blocks of the generated configuration.
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

// The roles import-direction reads from architecture.roles; the types and harness roles also have their own settings.
export const DIRECTION_ROLES = ['tests', 'config', 'env', 'runtime'] as const;

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
    from: { file: [{ isUnknown: true }, { categories: { noneOf: ['server'] } }] },
    disallow: { to: { file: { categories: 'server' } }, dependency: { kind: 'value' } },
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
