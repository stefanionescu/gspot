// Shared ESLint data comes from the JavaScript configuration's shipped assets.

// The check that runs ESLint, whose ignores with a rule become blocks of the generated configuration.
export const LINT_CHECK = 'javascript/eslint';

// The files the generated ESLint configuration treats as code, before framework component files join them.
export const ESLINT_CODE_FILES = '**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}';

export const ESLINT_TYPESCRIPT_FILES = '**/*.{ts,tsx,mts,cts}';
export const ESLINT_JAVASCRIPT_FILES = '**/*.{js,mjs,cjs,jsx}';

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
    identicalFunctions: 'identical_function_lines',
    barrelReexports: 'barrel_reexports',
    trivialStatements: 'min_function_statements',
};

// The limits JavaScript files read on their own, over the TypeScript ones.
export const ESLINT_JAVASCRIPT_LIMITS: Record<string, string> = {
    parameters: 'function_parameters',
    trivialStatements: 'min_function_statements',
};

// The roles import-direction reads from architecture.roles; the types and harness roles also have their own settings.
export const DIRECTION_ROLES = ['tests', 'config', 'env', 'runtime'];

/** Frameworks whose application sources use browser APIs. Build scripts retain Node.js. */
export const ESLINT_BROWSER_CONFIGURATIONS = ['react', 'vue', 'svelte', 'vite'];
