export const SHARED_PREFIX = '_';

export const SUPABASE_PROJECT_FILE = 'supabase/config.toml';

export const DENO_LOCATION = /at (?<file>file:\/\/\S+?):(?<line>\d+):\d+/u;

export const ADMIN_KEY_NAMES = [
    'SERVICE_ROLE_KEY',
    'service_role_key',
    'serviceRoleKey',
    'SUPABASE_SECRET_KEY',
    'supabase_secret_key',
    'supabaseSecretKey',
    'sb_secret_',
] as const;

/** Client file extensions that the language tags of the inventory do not cover. */
export const ADMIN_KEY_EXTENSIONS = ['.kt', '.dart'] as const;

export const DENO_CONFIG_FILES = ['deno.json', 'deno.jsonc'] as const;

export const DENO_CONFIG_FLAG = '--config';

export const FILE_URL_PREFIX = 'file://';

export const FUNCTION_ENTRY = /\/index\.tsx?$/u;

export const DENO_LINT_COMMAND = ['deno', 'lint', '--json'] as const;

export const DENO_CHECK_COMMAND = ['deno', 'check', '--quiet'] as const;

export const ADMIN_KEY_TAGS = ['javascript', 'typescript', 'vue', 'svelte', 'astro', 'swift', 'python'] as const;
