// The literal values generation/eslint reads: names, patterns, limits, and tables.

// The files the generated ESLint configuration treats as code, before framework component files join them.
export const ESLINT_CODE_FILES = '**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}';

// The check that runs ESLint, whose ignores with a rule become blocks of the generated configuration.
export const LINT_CHECK = 'javascript/eslint';

// The Node.js range the Node rules assume when the policy names none.
export const DEFAULT_NODE_VERSION = '>=22.0.0';

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
    identicalFunctions: 'duplicate_lines',
    barrelReexports: 'barrel_reexports',
    trivialStatements: 'trivial_statements',
};

// The limits JavaScript files read on their own, over the TypeScript ones.
export const ESLINT_JAVASCRIPT_LIMITS: Record<string, string> = {
    parameters: 'function_parameters',
    trivialStatements: 'trivial_statements',
};

// The roles import-direction reads from architecture.roles; the types and harness roles also have their own settings.
export const DIRECTION_ROLES = ['tests', 'config', 'env', 'runtime'];

// The files registry-instances accepts a registry in, before the configuration folder joins them.
export const REGISTRY_FILES = ['**/registry.ts', '**/registry.tsx', '**/registry.js'];
