export const REQUIRED_HEADERS = {
    'x-content-type-options': /^nosniff$/iu,
    'referrer-policy': /\S/u,
    'x-frame-options': /^(?:deny|sameorigin)$/iu,
} as const;

export const HTTP_HEADER_LINE = /^[A-Za-z!][\w!#$%&'*+.^`|~-]*:\s*\S/u;

export const REDIRECT_STATUS_CODES = new Set(['200', '301', '302', '303', '307', '308']);

export const REDIRECT_FIELDS = { minimum: 2, maximum: 3 } as const;

export const REDIRECTS_FILE = '_redirects';

export const FRAME_ANCESTORS = /frame-ancestors/iu;

export const PATH_PREFIXES = ['/', 'https://'] as const;

export const DETACH_PREFIX = '! ';

export const HEADERS_FILE = '_headers';

export const MISSING_HEADER_RULE = 'missing-header';

export const HEADER_WITHOUT_PATH_MESSAGE = 'Add a path line before this header.';

export const MALFORMED_HEADER_MESSAGE = 'Write this header as Name: value.';

export const BLOCK_PATH_MESSAGE = 'Start this block with a path beginning with / or an https:// address.';

export const REDIRECT_FIELDS_MESSAGE = 'Write a redirect as a source, a destination, and an optional status.';

export const REDIRECT_SOURCE_MESSAGE = 'Start the source with /.';

export const INDENTED_LINE = /^\s/u;

export const REDIRECT_DESTINATION_MESSAGE = 'Start the destination with /, http:// or https://.';

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

export const SERVICE_ROLE_KEY_EXTENSIONS = ['.kt', '.dart'] as const;

export const DENO_CONFIG_FILES = ['deno.json', 'deno.jsonc'] as const;

export const DENO_CONFIG_FLAG = '--config';

export const FILE_URL_PREFIX = 'file://';

export const FUNCTION_ENTRYPOINT = /\/index\.tsx?$/u;

export const DENO_LINT_COMMAND = ['deno', 'lint', '--json'] as const;

export const DENO_CHECK_COMMAND = ['deno', 'check', '--quiet'] as const;

export const SERVICE_ROLE_KEY_TAGS = ['javascript', 'typescript', 'vue', 'svelte', 'astro', 'swift', 'python'] as const;

export const DENO_LINT_NAME = 'deno lint';

export const SERVICE_ROLE_KEY_MESSAGE =
    'This file names a privileged Supabase key, which bypasses row level security, outside the paths allowed to hold it.';

export const DENO_CHECK_FAILED_MESSAGE = 'The deno check command failed.';

export const RULES = { bucketPolicy: 'bucket-policy', serviceRoleKey: 'service-role-key' } as const;

export const DENO_IMPORT_MAP_FLAG = '--import-map';
