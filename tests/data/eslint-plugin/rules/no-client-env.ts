/** Runtime bindings that the ESLint reference tracker must resolve. */
export const ENVIRONMENT_GLOBALS = { process: 'readonly', Bun: 'readonly', Deno: 'readonly' } as const;
