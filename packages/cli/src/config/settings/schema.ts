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

export const LINE_ENDINGS = ['lf', 'crlf'] as const;

export const QUOTE_STYLES = ['single', 'double'] as const;

export const TRAILING_COMMAS = ['all', 'es5', 'none'] as const;

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
    'template',
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
    { configurations: ['typescript', 'python'], limits: { function_lines: 60, python: { file_lines: 300 } } },
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
    { rules: { enabled: true } },
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
    scope: 'Settings for one folder: its configurations and the tables that differ from the root.',
    import_rule:
        'Groups of files in import order: code may import the files of its own rule and of every rule listed above it.',
    javascript: 'The script files, the folders relative imports stay inside, and the modules the runtime provides.',
    python: 'The modules that the host application provides, and the folders basedpyright also searches.',
    trpc: 'The files that declare tRPC procedures, and the server files that other files import only as types.',
    zustand: 'The files that may create a Zustand store.',
    format: 'Indentation, line width, quotes, and line endings for every formatter, with overrides for some paths.',
    limits: 'Size and complexity limits for files and functions, with values per language.',
    naming: 'Banned words, case, and length for the names of files, folders, and identifiers, with values per language.',
    cloudflare: 'The file that holds the generated Cloudflare binding types, and its interface name.',
    coverage: 'The lowest test coverage that the test checks accept, with minimums for single Swift targets.',
    dependencies:
        'How many days a new release waits before gspot installs it, the registries lockfiles may use, and the Bun install scanner.',
    docs: 'Headings that documentation may not use, and URLs that the link check accepts.',
    drizzle: 'The names of Drizzle clients in your code.',
    licenses: 'The licenses that dependencies may have, and single packages accepted with a reason.',
    openapi: 'The committed OpenAPI document, and the command that generates it.',
    postgres: 'The migrations folder, the schemas that clients read, and the migrations that may not change.',
    secrets: 'The env example files, and the functions in your code that read environment variables.',
    site: 'How the site builds, where the built files go, the pages the sitemap leaves out, and the size limits of its files.',
    spelling: 'The English locale of the spelling check, and the words it accepts, each with a reason.',
    supabase: 'The folders of Supabase edge functions, the schemas, and the generated types file.',
    translations: 'The base locale and the folder of message files.',
    swift: 'The Xcode project, scheme, and destination that the Swift build uses.',
    repository: 'The largest file that Git may track, in kilobytes.',
    prose: 'The longest sentence, list item, and paragraph that the prose check accepts.',
    duplication: 'The smallest copy, in lines and tokens, that the duplication check reports.',
    xcode: 'The entitlements that an Xcode project may request.',
    tools: 'Options for single tools, such as lint rule options. gspot writes them into the generated files.',
    ignore: 'Checks and lint rules turned off for some paths or everywhere, each with a reason.',
    command_check: 'Your own commands, run as checks with a stage, a file list, and an output format.',
    structure:
        'Whether files may re-export the exports of other files, and which files may read environment variables.',
    hooks: 'Whether gspot install turns on the Git hooks.',
    ci: 'Whether gspot writes a CI workflow, for which provider, and on which systems it runs.',
    rules: 'Whether gspot writes rules for coding agents, and which rule files it leaves out.',
};

export const ALLOWED_WORD = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_]*(?:[-'\u{2019}][\p{L}\p{M}\p{N}_]+)*$/u;

export const SPELLING_LOCALES = ['en', 'en-us', 'en-gb', 'en-au', 'en-ca'] as const;

export const REEXPORT_MODES = ['none', 'index-only'] as const;

export const LEVEL_SUMMARY =
    "Correctness, security, accessibility, type safety, routine formatting, and the project's own declared checks apply at both levels.";

export const ALL_LEVEL_SUMMARY =
    'Level all adds checks and rules for word choice, architecture, naming, doc comments, declaration order, duplication, API style, and complexity.';

export const ESLINT_SEVERITIES = ['off', 'warn', 'error'] as const;

export const ESLINT_PLUGIN_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

export const ESLINT_PLUGIN_MODULE = /\.m?js$/u;

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

export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;

export const UNSAFE_PATH_END = /[. ]$/u;

export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

export const MAX_PERCENTAGE = 100;
