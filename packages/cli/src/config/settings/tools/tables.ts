export const MARKDOWNLINT_RULE_ID_REFUSAL =
    'Name a rule by its ID, such as MD010 = { spaces_per_tab = 4 }. This table holds rule options only.';

export const MARKDOWNLINT_RULE_ID = /^MD\d{3}$/u;

export const KNIP_PACKAGE_NAME = /^[^*+\\(|{^$\s]+$/u;

export const DOCSTRING_CONVENTIONS = ['google', 'numpy', 'pep257'] as const;

export const RULE_CONDITIONS = ['always', 'never'] as const;

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
