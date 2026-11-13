import { GSPOT_FOLDER } from '#cli/config/system.ts';

// ci
export const CI_PINS = {
    mise: { version: '2026.10.7' },
    actions: {
        checkout: {
            name: 'actions/checkout',
            sha: '3d3c42e5aac5ba805825da76410c181273ba90b1',
            version: 'v7.0.1',
        },
        mise: {
            name: 'jdx/mise-action',
            sha: '2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca',
            version: 'v5.1.1',
        },
    },
    githubRunners: {
        linux: { label: 'ubuntu-24.04', arch: 'x64' },
        macos: { label: 'macos-26', arch: 'arm64' },
        windows: { label: 'windows-2025', arch: 'x64' },
    },
} as const;
export const GITHUB_ONLY_CI_KEYS = ['operating_systems', 'linux_runner'] as const;

// configuration tables
export const DOCSTRING_CONVENTIONS = ['google', 'numpy', 'pep257'] as const;
export const FROZEN_ALL = 'all';
export const FROZEN_NONE = 'none';
export const FROZEN_VERSION = /^V?\d+$/u;

// format fields
export const ARROW_PARENS = ['always', 'avoid'] as const;
export const FORMAT_INDENT_STYLES = ['space', 'tab'] as const;
export const FORMAT_OVERRIDE_MIN_FIELDS = 2;
export const INDENT_DEFAULT = 4;
export const INDENT_MAX = 8;
export const MAX_PERCENTAGE = 100;
export const PRINT_WIDTH_DEFAULT = 120;
export const PRINT_WIDTH_MAX = 400;
export const PRINT_WIDTH_MIN = 40;
export const PROSE_WRAPS = ['always', 'never', 'preserve'] as const;
export const QUOTE_STYLES = ['single', 'double'] as const;
export const RELATIVE_PATH_PATTERN = new RegExp(
    String.raw`^(?:[^\\:\u0000-\u001f\u007f-\u009f]|\\[()\[\]{}*?!+@,])+$`,
    'u',
);
export const REMOVAL_REASON_DESCRIPTION = 'Why you removed this configuration, in two or more words.';
export const SETTING_ORIGIN_KINDS = ['default', 'configuration', 'root', 'scope', 'unset'] as const;
export const TRAILING_COMMAS = ['all', 'es5', 'none'] as const;

// general tables
export const ALLOWED_WORD = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_]*(?:[-'\u{2019}][\p{L}\p{M}\p{N}_]+)*$/u;
export const REEXPORT_MODES = ['none', 'index-only'] as const;
export const SPELLING_LOCALES = ['en', 'en-us', 'en-gb', 'en-au', 'en-ca'] as const;

// json schema
export const HIDDEN_FACT_KEYS = [
    'configurations',
    'languages',
    'reason_for',
    'reason_values',
    'language_defaults',
    'path_role',
    'leftOut',
    'default_all',
    'reasoned',
    'variantOf',
    'value_names',
] as const;
export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';
export const SCHEMA_DESCRIPTION = 'The settings of gspot for one repository.';

// levels
export const ALL_LEVEL_SUMMARY =
    'Level all adds stricter rules, which can flag correct code or enforce a style preference.';
export const LEVEL_SUMMARY =
    'Level basic checks for bugs, security problems, code style, broken docs and config, formatting, and a reason on each suppression.';

// lint rule records
export const COMMITLINT_ENUM_SETTINGS = new Map([
    ['type-enum', 'commits.types'],
    ['scope-enum', 'commits.scopes'],
]);
export const ESLINT_PLUGIN_MODULE = /\.m?js$/u;
export const ESLINT_PLUGIN_NAME = /^@?[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
export const ESLINT_SEVERITIES = ['off', 'warn', 'error'] as const;
export const MATCHING_PROPERTY_NAME = /^[-/]/u;
export const NPM_PACKAGE_NAME = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/u;
export const PLUGIN_SOURCE_REFUSAL = 'Name a tracked module with path, or an npm package with package and version.';
export const RULE_CONDITIONS = ['always', 'never'] as const;
export const VENDOR_PREFIX_RULE = 'property-no-vendor-prefix';

// naming tables
export const NAMING_TABLE_CATEGORIES = [
    'files',
    'folders',
    'types',
    'functions',
    'parameters',
    'variables',
    'properties',
] as const;
export const NAMING_LANGUAGE_CATEGORIES = {
    typescript: NAMING_TABLE_CATEGORIES,
    python: NAMING_TABLE_CATEGORIES,
    swift: NAMING_TABLE_CATEGORIES,
    bash: ['files', 'folders', 'functions', 'variables'],
    sql: ['files', 'folders', 'functions', 'parameters'],
    css: ['files', 'folders'],
    html: ['files', 'folders'],
} as const;
export const NAMING_LANGUAGES = Object.keys(NAMING_LANGUAGE_CATEGORIES) as Array<
    keyof typeof NAMING_LANGUAGE_CATEGORIES
>;
export const NAMING_TERM = /^[\p{L}\p{N}]+(?:[ -][\p{L}\p{N}]+)*$/u;

// setting values
export const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);
export const SHIPPED_DEFAULT_ORIGIN = 'gspot default';
export const SHIPPED_DEFAULT_OWNER = 'gspot';
export const TABLE_KEY_SEGMENTS = 2;

// settings file
export const COMMAND_CHECK_ID = /^(?!(?:commit|push)$)[^\s,]+$/u;
export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
export const GSPOT_FOLDER_PATH = new RegExp(`^\\${GSPOT_FOLDER}(?:/|$)`, 'iu');
export const LEFT_OUT_NOTES = {
    ci: 'CI stays off; run gspot set ci.enabled true',
    paths: 'names paths of that repository',
    code: 'runs code',
    repository: 'describes that repository',
    check: 'ignores a command check',
} as const;
export const NO_CHECK_RULE_MESSAGE = 'An ignore without check cannot name a rule. Add the check that owns the rule.';
export const SCOPE_PATH_MESSAGES = {
    portable: String.raw`Use folder names that work on every system: no empty or dot segment, no \ : < > " | ? * or control character, no name that ends in a dot or a space, and no device name such as nul.`,
    gspot: `gspot writes its own files in ${GSPOT_FOLDER}. Choose a scope folder outside it.`,
} as const;
export const SETTINGS_EXAMPLES = [
    { level: 'all' },
    { configurations: ['typescript', 'nextjs', 'markdown'] },
    { test_files: ['tests/**/*.test.ts'] },
    { scope: [{ path: 'services/api', configurations: ['python', 'fastapi'] }] },
    { configurations: ['typescript', 'python'], limits: { max_function_lines: 60, python: { max_file_lines: 300 } } },
    {
        configurations: ['naming'],
        naming: {
            exception: [
                {
                    paths: ['migrations/**'],
                    cases: ['timestamp-snake'],
                    reason: 'Migration filenames begin with their version.',
                },
            ],
        },
    },
    { structure: { environment_readers: ['src/environment.ts'] } },
    {
        structure: {
            reexports: { value: 'index-only', reason: 'The library uses index files to publish its public API.' },
        },
    },
    { configurations: ['javascript'], tools: { eslint: { rules: { 'no-console': [{ allow: ['warn'] }] } } } },
    { format: { indent_width: 4, print_width: 100 } },
    { dependencies: { min_release_age_days: 7 } },
    { spelling: { allowed_words: { Acme: 'The project uses this product name.' } } },
    { licenses: { allowed: ['MIT', 'Apache-2.0'] } },
    {
        ignore: [
            {
                check: 'javascript/eslint',
                rule: 'no-console',
                paths: ['scripts/**'],
                reason: 'Scripts print their results.',
            },
        ],
    },
    {
        command_check: [
            {
                id: 'project/notes',
                command: ['node', 'scripts/check-notes.mjs', '{files}'],
                paths: ['notes/**'],
                stage: 'commit',
                summary: 'Check project notes',
            },
        ],
    },
    { hooks: { enabled: true } },
    { ci: { enabled: true, provider: 'github', operating_systems: ['linux'] } },
    { rule_files: { enabled: true } },
    { tool_timeout_seconds: 300 },
    { import_rule: [{ name: 'core', paths: ['src/core/**'] }] },
] as const;
export const TABLE_DESCRIPTIONS: Readonly<Record<string, string>> = {
    scope: 'Settings for one folder.',
    javascript: 'Tell the JavaScript checks what they cannot work out alone: scripts, entry points, and import limits.',
    python: 'Tell the Python tools where imports resolve from, and which docstring style to check.',
    trpc: 'The files that hold tRPC routers and server code.',
    zustand: 'Where a Zustand store may live.',
    format: 'How every formatter lays out your code.',
    limits: 'Size and complexity limits, with values per language.',
    naming: 'The naming rules for files, folders, and identifiers, with values per language.',
    cloudflare: 'What `wrangler types` writes, for the check that keeps the file current.',
    commits: 'The types and scopes that a commit message may use.',
    coverage: 'The share of code that tests must cover.',
    dependencies: 'How gspot and the dependency checks treat new packages.',
    docker: 'Where base images may come from, and which severities Trivy reports.',
    docs: 'The external links that the link check leaves alone.',
    drizzle: 'How the Drizzle checks find your clients.',
    json: 'Schemas for data files that SchemaStore does not know.',
    licenses: 'The licenses that dependencies may use, and the packages excepted from them.',
    nginx: 'The container that tests your nginx configuration.',
    openapi: 'The committed OpenAPI document, and the command that writes it.',
    postgres: 'Which schemas and migrations the Postgres checks read, and how your runner applies them.',
    secrets: 'Where your example environment files are, and which functions read environment variables.',
    security: 'Your own Semgrep rules.',
    site: 'How the site builds, and the class names and pages that the site checks accept.',
    spelling: 'The English dialect and the extra words that the spelling check accepts.',
    sql: 'How SQLFluff parses your queries.',
    supabase: 'Where the edge functions and the generated database types live.',
    translations: 'Where the message files live, and which locale the others follow.',
    swift: 'Which Xcode project to build, and which imports the analyzer keeps.',
    repository: 'What Git may track.',
    prose: 'Headings to ban, and the length limits of documentation.',
    xcode: 'What an Xcode project may request.',
    tools: 'Options for single tools.',
    ignore: 'Checks and lint rules turned off, each with a reason.',
    command_check: 'Your own commands, run as checks.',
    structure: 'Re-exports, the size of a copied block, and the files that may read the environment.',
    hooks: 'Whether gspot install turns on the Git hooks.',
    ci: 'The CI workflow that gspot writes.',
    rule_files: 'The rule files that gspot writes for coding agents.',
};
export const TOOL_TIMEOUT_SECONDS_DEFAULT = 600;
export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;
export const UNSAFE_PATH_END = /[. ]$/u;

// tool tables
export const BIOME_COMPLEXITY_MAX = 255;
export const IMPORT_EXTENSION_STYLES = ['js', 'ts', 'extensionless'] as const;
export const KNIP_PACKAGE_NAME = /^[^*+\\(|{^$\s]+$/u;
export const MARKDOWNLINT_RULE_ID = /^MD\d{3}$/u;
export const MARKDOWNLINT_RULE_ID_REFUSAL =
    'Name a rule by its ID, such as MD024 = { siblings_only = false }. This table holds rule options only.';
export const RUFF_IMPORT_ORDER_SELECTOR = /^I\d*$/u;
export const RUFF_RULE_PREFIX = /^[A-Z]+\d{0,2}$/u;
export const RUFF_SELECTOR = /^[A-Z]+\d*$/u;
export const SQLFLUFF_DIALECTS = [
    'ansi',
    'athena',
    'bigquery',
    'clickhouse',
    'databricks',
    'db2',
    'doris',
    'duckdb',
    'exasol',
    'flink',
    'greenplum',
    'hive',
    'impala',
    'materialize',
    'mariadb',
    'mysql',
    'oracle',
    'postgres',
    'redshift',
    'snowflake',
    'soql',
    'sparksql',
    'sqlite',
    'starrocks',
    'teradata',
    'trino',
    'tsql',
    'vertica',
] as const;
export const TRIVY_SEVERITIES = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
