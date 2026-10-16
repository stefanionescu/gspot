/** Runtime bindings that the ESLint reference tracker must resolve. */
export const ENVIRONMENT_GLOBALS = { process: 'readonly', Bun: 'readonly', Deno: 'readonly' } as const;

export const IMPORT_ALIASES = { '@/': 'src/', '@config/': 'config/' } as const;

export const CLIENT_ENV_SAMPLE = {
    broken: '"use client";\nexport const endpoint = process.env.PRIVATE_API_URL;\n',
    corrected: '"use client";\nexport const endpoint = "/api/search";\n',
} as const;

export const IMPORT_BOUNDARY_FOLDERS = ['api', 'supabase'];
