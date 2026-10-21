/** Runtime bindings that the ESLint reference tracker must resolve. */
export const ENVIRONMENT_GLOBALS = { process: 'readonly', Bun: 'readonly', Deno: 'readonly' } as const;

export const IMPORT_ALIASES = { '@/': 'src/', '@config/': 'config/' } as const;

export const PROJECT_FOLDERS = ['api', 'supabase'];
