export const SHARED_PREFIX = '_';

export const SUPABASE_CONFIG = 'supabase/config.toml';

export const MIGRATION_NAME = /^\d{14}_[a-z][a-z\d_]*\.sql$/u;

export const DENO_LOCATION = /at (?<file>file:\/\/\S+?):(?<line>\d+):\d+/u;

export const ADMIN_KEY_NAMES = [
    'SERVICE_ROLE_KEY',
    'service_role_key',
    'serviceRoleKey',
    'SUPABASE_SECRET_KEY',
    'supabase_secret_key',
    'supabaseSecretKey',
    'sb_secret_',
];

/** Client languages not represented by the inventory's language tags. */
export const ADMIN_KEY_EXTENSIONS = ['.kt', '.dart'];
