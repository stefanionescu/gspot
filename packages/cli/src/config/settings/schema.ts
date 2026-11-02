import { GSPOT_FOLDER } from '#cli/config/parsers.ts';

export const LEFT_OUT_NOTES = {
    ci: 'CI stays off; run gspot set ci.enabled true',
    paths: 'names paths of that repository',
    code: 'runs code',
    repository: 'describes that repository',
    check: 'ignores a command check',
} as const;

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
        restoreCache: {
            name: 'actions/cache/restore',
            sha: '55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
            version: 'v6.1.0',
        },
        saveCache: {
            name: 'actions/cache/save',
            sha: '55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
            version: 'v6.1.0',
        },
    },
    githubRunners: {
        linux: { label: 'ubuntu-24.04', arch: 'x64' },
        macos: { label: 'macos-26', arch: 'arm64' },
        windows: { label: 'windows-2025', arch: 'x64' },
    },
} as const;

export const FROZEN_VERSION = /^V?\d+$/u;

export const INDENT_MAX = 8;

export const PRINT_WIDTH_MIN = 40;

export const PRINT_WIDTH_MAX = 400;

export const FORMAT_OVERRIDE_MIN_FIELDS = 2;

export const FORMAT_INDENT_STYLES = ['space', 'tab'] as const;

export const REMOVAL_REASON_DESCRIPTION = 'Why you removed this configuration, in two or more words.';

export const QUOTE_STYLES = ['single', 'double'] as const;

export const TRAILING_COMMAS = ['all', 'es5', 'none'] as const;

export const ARROW_PARENS = ['always', 'avoid'] as const;

export const PROSE_WRAPS = ['always', 'never', 'preserve'] as const;

export const RELATIVE_PATH_PATTERN = new RegExp(
    String.raw`^(?:[^\\:\u0000-\u001f\u007f-\u009f]|\\[()\[\]{}*?!+@,])+$`,
    'u',
);

export const TABLE_KEY_SEGMENTS = 2;

export const SHIPPED_DEFAULT_ORIGIN = 'gspot default';

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
    javascript: NAMING_TABLE_CATEGORIES,
    python: NAMING_TABLE_CATEGORIES,
    swift: NAMING_TABLE_CATEGORIES,
    bash: ['files', 'folders', 'functions', 'variables'],
    sql: ['files', 'folders', 'functions', 'parameters'],
    css: ['files', 'folders'],
    html: ['files', 'folders'],
} as const;

export const HIDDEN_FACT_KEYS = [
    'configurations',
    'languages',
    'reason_when',
    'reason_values',
    'language_defaults',
    'path_role',
    'leftOut',
    'default_all',
    'reasoned',
    'variantOf',
] as const;

export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

export const SCHEMA_DESCRIPTION = 'The settings of gspot for one repository.';

export const CI_PROVIDERS = ['github', 'gitlab'] as const;

export const GITHUB_ONLY_CI_KEYS = ['operating_systems', 'linux_runner'] as const;

export const SETTINGS_EXAMPLES = [
    { level: 'all' },
    { configurations: ['typescript', 'nextjs', 'markdown'] },
    { test_files: ['tests/**/*.test.ts'] },
    { scope: [{ path: 'services/api', configurations: ['python', 'fastapi'] }] },
    { configurations: ['typescript', 'python'], limits: { max_function_lines: 60, python: { max_file_lines: 300 } } },
    {
        configurations: ['naming'],
        naming: {
            override: [
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

export const GSPOT_FOLDER_PATH = new RegExp(`^\\${GSPOT_FOLDER}(?:/|$)`, 'iu');

export const SCOPE_PATH_MESSAGES = {
    portable: String.raw`Use folder names that work on every system: no empty or dot segment, no \ : < > " | ? * or control character, no name that ends in a dot or a space, and no device name such as nul.`,
    gspot: `gspot writes its own files in ${GSPOT_FOLDER}. Choose a scope folder outside it.`,
} as const;

export const NO_CHECK_RULE_MESSAGE = 'An ignore without check cannot name a rule. Add the check that owns the rule.';

export const COMMAND_CHECK_ID = /^[^\s,]+$/u;

export const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);

export const TABLE_DESCRIPTIONS: Readonly<Record<string, string>> = {
    scope: 'Settings for one folder.',
    import_rule: 'The import order of groups of files.',
    javascript: 'How the JavaScript checks read your project.',
    python: 'How the Python tools read your project.',
    trpc: 'Where the tRPC checks look.',
    zustand: 'Where the Zustand check looks.',
    format: 'How every formatter lays out your code.',
    limits: 'Size and complexity limits, with values per language.',
    naming: 'The naming rules for files, folders, and identifiers, with values per language.',
    cloudflare: 'The generated Cloudflare binding types.',
    commits: 'What the commit message check accepts.',
    coverage: 'The test coverage that the test checks require.',
    data_files: 'The schemas that the data file check adds.',
    dependencies: 'How gspot and the dependency checks treat new packages.',
    docker: 'What the Docker checks accept.',
    docs: 'What the documentation checks accept.',
    drizzle: 'How the Drizzle checks find your clients.',
    licenses: 'What the license check accepts.',
    nginx: 'What the nginx check runs in.',
    openapi: 'The committed OpenAPI document.',
    postgres: 'What the Postgres checks read.',
    secrets: 'How the secrets checks read your environment variables.',
    security: 'What the security checks read.',
    site: 'How the site builds, and what the site checks accept.',
    spelling: 'What the spelling check accepts.',
    sql: 'How the SQL checks read your queries.',
    supabase: 'What the Supabase checks read.',
    translations: 'What the translation checks read.',
    swift: 'How the Swift checks build and read your project.',
    repository: 'What Git may track.',
    prose: 'What the prose check accepts.',
    xcode: 'What an Xcode project may request.',
    tools: 'Options for single tools.',
    ignore: 'Checks and lint rules turned off, each with a reason.',
    command_check: 'Your own commands, run as checks.',
    structure: 'What the structure checks accept.',
    hooks: 'Whether gspot install turns on the Git hooks.',
    ci: 'The CI workflow that gspot writes.',
    rule_files: 'The rule files that gspot writes for coding agents.',
};

export const ALLOWED_WORD = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_]*(?:[-'\u{2019}][\p{L}\p{M}\p{N}_]+)*$/u;

export const SPELLING_LOCALES = ['en', 'en-us', 'en-gb', 'en-au', 'en-ca'] as const;

export const REEXPORT_MODES = ['none', 'index-only'] as const;

export const LEVEL_SUMMARY = 'Level basic holds rules that rarely misfire on working code.';

export const ALL_LEVEL_SUMMARY = 'Level all adds rules with known false positives or taste.';

export const ESLINT_SEVERITIES = ['off', 'warn', 'error'] as const;

export const ESLINT_PLUGIN_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

export const ESLINT_PLUGIN_MODULE = /\.m?js$/u;

export const MARKDOWNLINT_RULE_ID_REFUSAL =
    'Name a rule by its ID, such as MD010 = { spaces_per_tab = 4 }. This table holds rule options only.';

export const MARKDOWNLINT_RULE_ID = /^MD\d{3}$/u;

export const KNIP_PACKAGE_NAME = /^[^*+\\(|{^$\s]+$/u;

export const DOCSTRING_CONVENTIONS = ['google', 'numpy', 'pep257'] as const;

export const RULE_CONDITIONS = ['always', 'never'] as const;

export const RUFF_SELECTOR = /^[A-Z]+\d*$/u;

export const RUFF_RULE_PREFIX = /^[A-Z]+\d{0,2}$/u;

export const IMPORT_EXTENSION_STYLES = ['js', 'ts', 'extensionless'] as const;

export const TRIVY_SEVERITIES = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

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

export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;

export const UNSAFE_PATH_END = /[. ]$/u;

export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

export const MAX_PERCENTAGE = 100;
