import { NODE_MODULES } from '#cli/config/system.ts';
import { GSPOT_FOLDER, PBXPROJ_FILE } from '#cli/config/parsers.ts';

export const SYNTAX_RULE = 'syntax';

export const SECURITY_DEFINER_MESSAGE =
    'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.';

export const DEFINER_SEARCH_PATH_RULE = 'definer-search-path';

export const FROZEN_RULE = 'frozen';

export const FROZEN_EDIT_MESSAGE =
    'This migration is at or before postgres.frozen_through and differs from its committed text. Restore it and write a new migration.';

export const FROZEN_THROUGH_NOTE = 'Set postgres.frozen_through to the last migration that has run everywhere.';

export const FOREIGN_KEY_INDEX_RULE = 'foreign-key-index';

export const GRANT_ALL_RULE = 'grant-all';

export const GRANT_ALL_MESSAGE = 'GRANT ALL gives every privilege, present and future; name the privileges.';

export const MISSING_VERSION_MESSAGE = 'The file name starts with no version number.';

export const MIGRATION_RULES = { version: 'version', duplicateVersion: 'duplicate-version', order: 'order' } as const;

export const SQUAWK_CHECK = 'postgres/squawk';

export const DOWN_MIGRATION_SUFFIX = '.down.sql';

export const MIGRATION_SYNTAX_SKIP = 'A migration does not parse. postgres/migration-order reports where.';

export const MIGRATION_DOWN = /^[\t ]*--[\t ]*migrate:down\b/mu;

export const ROW_SECURITY_RULE = 'row-security';

export const PUBLIC_SCHEMA = 'public';

export const CONSTRAINT_SUFFIXES: Readonly<Record<string, string>> = {
    CONSTR_PRIMARY: 'pkey',
    CONSTR_UNIQUE: 'key',
    CONSTR_FOREIGN: 'fkey',
};

export const SCHEMA_NAME_INDEX = -2;

export const SQUAWK_DEFAULT_LEVEL_OFF = [
    'prefer-bigint-over-int',
    'prefer-bigint-over-smallint',
    'prefer-identity',
    'prefer-text-field',
    'require-table-schema',
] as const;

export const SQUAWK_TABLE = 'tools.squawk';

export const HADOLINT_FAILURE_THRESHOLD = 'style';

export const HADOLINT_DEFAULT_LEVEL_OFF = [
    'DL3001',
    'DL3003',
    'DL3008',
    'DL3010',
    'DL3018',
    'DL3020',
    'DL3048',
    'DL4001',
] as const;

export const GIT_FOLDER = '.git';

export const TRIVY_SKIPPED_FOLDERS = [NODE_MODULES, GSPOT_FOLDER, GIT_FOLDER] as const;

export const HADOLINT_CHECK = 'docker/hadolint';

export const TRIVY_TABLE = 'tools.trivy';

export const SPECTRAL_DEFAULT_LEVEL_OFF = [
    'info-contact',
    'info-description',
    'operation-description',
    'operation-tags',
] as const;

export const ANSIBLE_CONFIG_FILE = 'ansible.cfg';

export const ANSIBLE_CONFIG_EXTENSION = '.cfg';

export const COMPOSE_OVERRIDE = /^(?<base>compose|docker-compose)\.[^.]+\.ya?ml$/u;

export const COMPOSE_SUFFIXES = ['.yaml', '.yml'] as const;

export const COMPOSE_CHECK = 'docker/compose';

export const COMPOSE_FILE_FLAG = '-f';

export const DOCKERIGNORE_PATTERNS = [GIT_FOLDER, '.env'] as const;

export const EDGE_SLASHES = /^\/|\/$/gu;

export const IGNORE_PATTERN_FORMS = [
    ['', ''],
    ['**/', ''],
    ['', '*'],
    ['**/', '*'],
] as const;

export const DOCKERIGNORE = '.dockerignore';

export const EXCLUDE_ALL_LINES: ReadonlySet<string> = new Set(['*', '**', '**/*']);

export const TRIVY_FINDINGS_EXIT_CODE = 10;

export const TRIVY_IMAGE_COMMAND = [
    'trivy',
    'image',
    '--quiet',
    '--format',
    'json',
    '--scanners',
    'vuln,secret',
    '--exit-code',
    String(TRIVY_FINDINGS_EXIT_CODE),
    '--config',
] as const;

export const TRIVY_CONFIG_FILE = 'trivy';

export const DOCKER_RULES = { missingFile: 'missing-file', missingEntry: 'missing-entry', secret: 'secret' } as const;

export const SELF_REPOSITORY_MARKER = /^(\s*["']?)(\$|\\x24|\\u0024|\\U00000024)/u;

export const ACTION_FILES = ['action.yml', 'action.yaml'];

export const GITHUB_FOLDER = '.github/';

export const SELF_REFERENCE_PREFIX = '$/';

export const ENCODED_DOLLAR_SUFFIX = /24$/u;

export const NGINX_CONF = 'nginx.conf';

export const CERTIFICATE_ARGUMENTS = [
    'req',
    '-x509',
    '-nodes',
    '-newkey',
    'rsa:2048',
    '-subj',
    '/CN=localhost',
    '-days',
    '1',
] as const;

export const LOCAL_NAMES = new Set(['localhost', 'unix']);

export const HOST_PATTERNS = new Map([
    ['proxy_pass', /^https?:\/\/([A-Za-z][\w.-]*)/u],
    ['server', /^([A-Za-z][\w.-]*)/u],
]);

export const NGINX_FOLDER = '/etc/nginx';

export const ERROR_LOCATION = / in (?<file>\/[^\n]+):(?<line>\d+)\s*$/u;

export const OPENSSL_PROGRAM = 'openssl';

export const OPENSSL_KEY_FLAG = '-keyout';

export const OPENSSL_CERTIFICATE_FLAG = '-out';

export const ADD_HOST_FLAG = '--add-host';

export const VOLUME_FLAG = '-v';

export const NGINX_MAIN_TARGET = `${NGINX_FOLDER}/${NGINX_CONF}`;

export const CERTIFICATE_DIRECTIVES = {
    ssl_certificate_key: 'key',
    ssl_certificate: 'certificate',
    ssl_trusted_certificate: 'certificate',
} as const;

export const DOCKER_RUN_ARGUMENTS = ['run', '--rm'] as const;

export const LOOPBACK_ADDRESS = '127.0.0.1';

export const READ_ONLY_MOUNT = ':ro';

export const NGINX_TEST_COMMAND = ['nginx', '-T'] as const;

export const NGINX_KEY_FILE = 'key.pem';

export const NGINX_CERTIFICATE_FILE = 'certificate.pem';

export const NGINX_COPY_PREFIX = 'copy-';

export const NGINX_DUMP_FILE_LINE = /^# configuration file (?<path>[^\n]+):$/gmu;

export const NGINX_EMERGENCY_MARK = '[emerg]';

export const NGINX_VARIABLE_MARK = '$';

export const NGINX_TABLE = 'tools.nginx';

export const DOCKER_DAEMON_ERROR = /cannot connect to the docker daemon/iu;

export const ASSET_CONTENTS = 'Contents.json';

export const XCASSETS_FOLDER = '.xcassets/';

export const IMAGE_SET = `.imageset/${ASSET_CONTENTS}`;

export const PLIST_SUFFIX = '.plist';

export const ASSET_REFERENCE_ENDINGS = [
    '.swift',
    '.storyboard',
    '.xib',
    PLIST_SUFFIX,
    PBXPROJ_FILE,
    '.xcconfig',
] as const;

export const NAMED_SETS = [IMAGE_SET, `.colorset/${ASSET_CONTENTS}`] as const;

export const ASSET_KIND_SUFFIX = /(?:Color|Image)$/u;

export const WORD_SEPARATOR = /[^A-Za-z\d]/u;

export const XCSTRINGS_SUFFIX = '.xcstrings';

export const DEFAULT_SOURCE_LANGUAGE = 'en';

export const ENTITLEMENTS_SUFFIX = '.entitlements';

export const PLIST_KEY = /<key>(?<name>[^<]+)<\/key>/gu;

export const INSECURE_TRANSPORT_SETTING = /<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/u;

export const INSECURE_TRANSPORT_MESSAGE = 'NSAllowsArbitraryLoads is true, so every host may be reached without TLS.';

export const UNTARGETED_FILE_MESSAGE = 'This Swift file is in no target of the project.';

export const EMPTY_SET_MESSAGE = 'This image set names no image file.';

export const XCODE_RULES = {
    unusedAsset: 'unused-asset',
    missingTranslation: 'missing-translation',
    entitlement: 'entitlement',
    arbitraryLoads: 'arbitrary-loads',
    untargeted: 'untargeted',
    emptySet: 'empty-set',
    missingImage: 'missing-image',
} as const;

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

export const SUPABASE_CHECK_RULES = { bucketPolicy: 'bucket-policy', serviceRoleKey: 'service-role-key' } as const;

export const DENO_IMPORT_MAP_FLAG = '--import-map';

export const SQL_EXTENSION = '.sql';

export const GIXY_CHECK = 'nginx/gixy';

export const ANSIBLE_LINT_ALWAYS_OFF = ['experimental'] as const;

export const ANSIBLE_LINT_CHECK = 'ansible/ansible-lint';
