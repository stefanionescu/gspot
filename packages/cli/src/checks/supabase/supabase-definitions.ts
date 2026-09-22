// Constants of the supabase checks.

/** The Supabase project file. */
export const SUPABASE_CONFIG = 'supabase/config.toml';

/** A migration file name: fourteen digits, then snake case words. */
export const MIGRATION_NAME = /^\d{14}_[a-z][a-z\d_]*\.sql$/u;

/** The names that hold the key that bypasses row level security. */
export const ADMIN_KEY_NAMES = ['SERVICE_ROLE_KEY', 'service_role_key', 'serviceRoleKey'];

/** The extensions of the code the containment check reads. */
export const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.swift', '.py', '.kt', '.dart'];
