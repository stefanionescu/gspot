export const IMPORT_ALIASES = { '@/*': 'src/*', '@config/*': 'config/*' } as const;

export const PROJECT_FOLDERS = ['api', 'supabase'];

export const ENVIRONMENT_GLOBALS = { process: 'readonly', Bun: 'readonly' } as const;
