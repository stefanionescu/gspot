export const STORAGE_POLICY_TABLE = 'storage.objects';

export const SHARED_PREFIX = '_';

export const SUPABASE_PROJECT_FILE = 'supabase/config.toml';

export const DENO_LOCATION = /at (?<file>file:\/\/\S+?):(?<line>\d+):\d+/u;

export const SERVICE_ROLE_KEY_NAMES = [
    'SERVICE_ROLE_KEY',
    'service_role_key',
    'serviceRoleKey',
    'SUPABASE_SECRET_KEY',
    'supabase_secret_key',
    'supabaseSecretKey',
    'sb_secret_',
] as const;

export const FILE_URL_PREFIX = 'file://';

export const FUNCTION_ENTRYPOINT = /\/index\.tsx?$/u;

export const DENO_LINT_COMMAND = ['deno', 'lint', '--json'] as const;

export const DENO_CHECK_COMMAND = ['deno', 'check', '--quiet'] as const;

export const DENO_LINT_NAME = 'deno lint';

export const SERVICE_ROLE_KEY_MESSAGE =
    'This file names a privileged Supabase key, which bypasses row level security, outside the paths allowed to hold it.';

export const DENO_CHECK_FAILED_MESSAGE = 'The deno check command failed.';

export const SUPABASE_CHECK_RULES = {
    bucketPolicy: 'bucket-policy',
    typeError: 'type-error',
    serviceRoleKey: 'service-role-key',
    verifyJwt: 'verify-jwt',
} as const;

export const VERIFY_JWT_OFF = /^\s*verify_jwt\s*=\s*false\s*$/u;

export const VERIFY_JWT_MESSAGE =
    'This function skips the JWT check. Say why on this line, such as a signed webhook or a public endpoint.';

export const DENO_IMPORT_MAP_FLAG = '--import-map';

export const SUPABASE_RULES = { 'gspot/no-unvalidated-json-body': 'error' } as const;
