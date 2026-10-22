export const TYPED_LANGUAGES = ['typescript', 'vue', 'svelte', 'astro'] as const;

export const ENVIRONMENT_LANGUAGES = ['javascript', 'typescript', 'vue', 'svelte', 'astro'] as const;

export const TRIVIAL_FUNCTION_LIMIT = 'trivial_function_statements';

export const TRIVIAL_FUNCTIONS_RULE = 'gspot/no-trivial-functions';

export const TRIVIAL_FILES_RULE = 'gspot/no-trivial-files';

export const RESTRICTED_IMPORT_RULES: ReadonlySet<string> = new Set([
    'no-restricted-imports',
    '@typescript-eslint/no-restricted-imports',
]);

/** Restrict environment reads to the environment readers. */
export const ENVIRONMENT_RULES = {
    'n/no-process-env': ['error', { allowedVariables: ['NODE_ENV'] }],
    'no-restricted-properties': ['error', { object: 'Bun', property: 'env' }, { object: 'Deno', property: 'env' }],
} as const;
