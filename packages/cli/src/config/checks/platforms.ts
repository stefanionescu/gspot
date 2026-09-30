// The literal values the checks of docker, nginx, static-site, nextjs, express, supabase, postgres read: names, patterns, limits, and tables.

export const DOCKERIGNORE_ENTRIES = ['.git', 'node_modules', '.env'];
export const FINDINGS_EXIT = 10;
export const SHOWN_FINDINGS = 20;
export const COMPOSE_FILES = [
    '**/docker-compose*.yml',
    '**/docker-compose*.yaml',
    '**/compose*.yml',
    '**/compose*.yaml',
];

export const NGINX_ESCAPES: Record<string, string> = { t: '\t', r: '\r', n: '\n', '"': '"', "'": "'", '\\': '\\' };
export const WORD_START_STOPS = /[\s"'{};#\\]/u;
export const WORD_STOPS = /[\s{};\\]/u;
export const NGINX_PUNCTUATION = new Set([';', '{', '}']);
export const MAIN_FILE = 'nginx.conf';
export const DEFAULT_IMAGE = 'nginx:stable-alpine';
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
];
export const LOCAL_NAMES = new Set(['localhost', 'unix']);

export const HOST_PATTERNS = new Map([
    ['proxy_pass', /^https?:\/\/([A-Za-z][\w.-]*)/u],
    ['server', /^([A-Za-z][\w.-]*)/u],
]);

export const DEFAULT_BUILD_OUTPUT = 'dist';
export const BYTES_PER_KB = 1024;
export const SITEMAP_LOCATION = /<loc>\s*(?<url>[^<\s]+)\s*<\/loc>/gu;
// Below the all level, svgo must save a tenth of the file before the saving is reported.
export const REPORTED_SAVINGS_SHARE = 10;
export const TEXT_SUFFIX = /\.(?:html?|css|scss|m?js|ts|json|webmanifest|xml|txt|md|toml|ya?ml)$/u;
export const ASSET_FOLDER = /(?:^|\/)assets\//u;
export const REQUIRED_HEADERS: Record<string, RegExp> = {
    'x-content-type-options': /^nosniff$/iu,
    'referrer-policy': /\S/u,
    'x-frame-options': /^(?:deny|sameorigin)$/iu,
};
export const DEFAULT_BUILD = 'npm run build';
export const SHOWN_DIFFERENCES = 10;

export const SEGMENT_NAME = /^(?<kind>page|route)\.[jt]sx?$/u;
export const CONFIG_FILE = /(?:^|\/)next\.config\.(?:js|mjs|cjs|ts|mts)$/u;
export const SWITCHED_OFF = /\b(?<name>ignoreDuringBuilds|ignoreBuildErrors)\s*:\s*true\b/gu;
export const SECRET_KEY = /\b(?<name>[A-Z][A-Z\d_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Z\d_]*)\s*:/gu;
export const PAIRS: [string, string][] = [
    ['next', 'eslint-config-next'],
    ['next', '@next/eslint-plugin-next'],
    ['react', 'react-dom'],
];
export const SHOWN_LINES = 3;
export const TSC_LINE = /^(?<file>[^(]+)\((?<line>\d+),(?<column>\d+)\): error (?<rule>TS\d+): (?<text>.*)$/u;
export const CAUSE_MARKS = ['Please install', 'FATAL', 'Error:', '⨯'];

export const SPECTRAL_LINE = /^(?<file>.+):(?<line>\d+):\d+ (?:error|warning) (?<rule>\S+) "(?<text>.*)"/u;

export const DEFAULT_FUNCTIONS = 'supabase/functions';
export const SHARED_PREFIX = '_';
export const SUPABASE_CONFIG = 'supabase/config.toml';
export const CHECK_LOCATION = /at (?<file>file:\/\/\S+?):(?<line>\d+):\d+/u;
export const MIGRATION_NAME = /^\d{14}_[a-z][a-z\d_]*\.sql$/u;
export const DEFAULT_PATHS = [
    'supabase/functions/**',
    'supabase/tests/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/tests/**',
    'scripts/**',
];
export const ADMIN_KEY_NAMES = ['SERVICE_ROLE_KEY', 'service_role_key', 'serviceRoleKey'];
export const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.swift', '.py', '.kt', '.dart'];

export const MIGRATION_DOC_SECTIONS: Record<string, string> = {
    CreateSchemaStmt: 'Schema',
    CreateStmt: 'Tables',
    IndexStmt: 'Indexes',
    CreateFunctionStmt: 'Functions',
    CreateTrigStmt: 'Triggers',
    CreateExtensionStmt: 'Extensions',
};
export const MIGRATION_DOC_LABELS: Record<string, RegExp> = {
    CreateStmt: /^--\s*Table:/iu,
    CreateFunctionStmt: /^--\s*Function:/iu,
};
export const FROZEN_NONE = 'none';
export const FROZEN_ALL = 'all';
export const PURPOSE = /^--\s*Purpose:/iu;
export const SECTION = /^-- (?<name>[A-Z][A-Za-z ]+)$/u;
export const BLOCK_REACH = 12;
export const STATEMENT_WORDS: Record<string, string> = {
    CreateSchemaStmt: 'CREATE SCHEMA',
    CreateStmt: 'CREATE TABLE',
    IndexStmt: 'CREATE INDEX',
    CreateFunctionStmt: 'CREATE FUNCTION',
    CreateTrigStmt: 'CREATE TRIGGER',
    CreateExtensionStmt: 'CREATE EXTENSION',
};
export const DOC_SEPARATOR = '-- ============================================================================';
export const MIGRATION_FOLDERS = ['supabase/migrations', 'db/migrations', 'migrations'];
export const MIGRATION_VERSION = /^(?<version>\d+)/u;
export const KEY_KINDS = new Set(['CONSTR_PRIMARY', 'CONSTR_UNIQUE']);
export const CONSTRAINT_SUFFIXES: Record<string, string> = { CONSTR_PRIMARY: 'pkey', CONSTR_UNIQUE: 'key' };
// What the migrations declare, gathered across every file: tables, row security, policies, foreign keys, and indexes.
export const DEFAULT_SCHEMA = 'public';
