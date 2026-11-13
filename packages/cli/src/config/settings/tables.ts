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

// general tables
export const ALLOWED_WORD = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_]*(?:[-'\u{2019}][\p{L}\p{M}\p{N}_]+)*$/u;
export const REEXPORT_MODES = ['none', 'index-only'] as const;
export const SPELLING_LOCALES = ['en', 'en-us', 'en-gb', 'en-au', 'en-ca'] as const;

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

// ruff rule codes
export const RUFF_IMPORT_ORDER_SELECTOR = /^I\d*$/u;
export const RUFF_RULE_PREFIX = /^[A-Z]+\d{0,2}$/u;
export const RUFF_SELECTOR = /^[A-Z]+\d*$/u;

// tool tables
export const BIOME_COMPLEXITY_MAX = 255;
export const IMPORT_EXTENSION_STYLES = ['js', 'ts', 'extensionless'] as const;
export const KNIP_PACKAGE_NAME = /^[^*+\\(|{^$\s]+$/u;
export const MARKDOWNLINT_RULE_ID = /^MD\d{3}$/u;
export const MARKDOWNLINT_RULE_ID_REFUSAL =
    'Name a rule by its ID, such as MD024 = { siblings_only = false }. This table holds rule options only.';
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
