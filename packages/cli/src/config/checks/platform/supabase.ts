// The literal values checks/platform/supabase reads: names, patterns, limits, and tables.
import { TEST_FILE_GLOBS } from '#cli/config/repository/repository.ts';

export const DEFAULT_FUNCTIONS = 'supabase/functions';
export const SHARED_PREFIX = '_';
export const SUPABASE_CONFIG = 'supabase/config.toml';
export const CHECK_LOCATION = /at (?<file>file:\/\/\S+?):(?<line>\d+):\d+/u;
export const MIGRATION_NAME = /^\d{14}_[a-z][a-z\d_]*\.sql$/u;
export const DEFAULT_PATHS = ['supabase/functions/**', 'supabase/tests/**', ...TEST_FILE_GLOBS, 'scripts/**'];
export const ADMIN_KEY_NAMES = ['SERVICE_ROLE_KEY', 'service_role_key', 'serviceRoleKey'];
export const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.swift', '.py', '.kt', '.dart'];
