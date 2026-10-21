export const REASON_WORDS_MIN = 2;

export const SCHEMA_URL = 'https://generativespotting.com/gspot.schema.json';

export const SCHEMA_FILE = 'gspot.schema.json';

export const SETTINGS_REFERENCE_URL = 'generativespotting.com/reference/gspot-toml/';

export const NAMED_FINDING_CHECKS: ReadonlySet<string> = new Set(['structure/trivial-functions', 'python/vulture']);

export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

export const SETTING_LANGUAGES = ['typescript', 'javascript', 'python', 'bash', 'swift', 'sql', 'css', 'html'] as const;

export const ESLINT_OPTION_STRING = /^(?!(?:off|warn|error)$)[\s\S]*$/u;

export const RULE_OPTIONS_REFUSAL =
    'This table holds options only, without a severity; the level decides which rules run. To turn {rule} off, run gspot ignore {check} --rule {rule} --reason "<why>".';

export const INDENT_MAX = 8;

export const PRINT_WIDTH_MIN = 40;

export const PRINT_WIDTH_MAX = 400;

export const RULE_TOKEN = '{rule}';

/** Complete written examples used by the editor schema and settings reference. */
export const SETTINGS_EXAMPLES = [
    { level: 'recommended' },
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
    { allowed_words: { Acme: 'The project uses this product name.' } },
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
                name: 'project/notes',
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

export const FORMAT_INDENT_STYLES = ['space', 'tab'] as const;

export const LINE_ENDINGS = ['lf', 'crlf'] as const;

export const QUOTE_STYLES = ['single', 'double'] as const;

export const TRAILING_COMMAS = ['all', 'es5', 'none'] as const;

export const CI_PROVIDERS = ['github', 'gitlab'] as const;

export const REEXPORT_MODES = ['none', 'index-only'] as const;

export const SPELLING_LOCALES = ['en', 'en-us', 'en-gb', 'en-au', 'en-ca'] as const;

export const IMPORT_EXTENSION_STYLES = ['js', 'ts', 'extensionless'] as const;

export const DOCSTRING_CONVENTIONS = ['google', 'numpy', 'pep257'] as const;

export const RULE_CONDITIONS = ['always', 'never'] as const;

export const ALLOWED_WORD = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_]*(?:[-'’][\p{L}\p{M}\p{N}_]+)*$/u;

export const KNIP_PACKAGE_NAME = /^[^*+\\(|{^$\s]+$/u;

export const ESLINT_PLUGIN_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

/** Your own ESLint plugin: an ES module that Node loads without a build step. */
export const ESLINT_PLUGIN_MODULE = /\.m?js$/u;

export const NAMING_TABLE_CATEGORIES = [
    'files',
    'folders',
    'types',
    'functions',
    'parameters',
    'variables',
    'properties',
] as const;

/** The naming categories that the name reader of each language reports; its table accepts only these. */
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

/** The description of the reason of a reasoned value, by the change that needs a reason. */
export const REASON_DESCRIPTIONS = {
    raising: 'Why this code needs more than the default; required when you raise the value.',
    lowering: 'Why this code needs less than the default; required when you lower the value.',
    adding: 'Why these entries belong; required when you add an entry.',
} as const;

export const INTERNAL_FACT_KEYS = [
    'configurations',
    'languages',
    'categories',
    'reason_needed',
    'reason_values',
    'language_defaults',
    'path_role',
    'default_all',
] as const;

/** What each top-level table of gspot.toml holds, for editors that show the schema on hover. */
export const TABLE_DESCRIPTIONS: Readonly<Record<string, string>> = {
    scope: 'Settings for one folder: its configurations and the tables that differ from the root.',
    import_rule:
        'Groups of files in import order: code may import the files of its own rule and of every rule listed above it.',
    javascript: 'The script files, which may print to the console and exit, and the modules the runtime provides.',
    python: 'The modules that the host application provides, and the folders basedpyright also searches.',
    trpc: 'The files that declare tRPC procedures, and the server files that other files import only as types.',
    zustand: 'The files that may create a Zustand store.',
    format: 'Indentation, line width, quotes, and line endings for every formatter, with overrides for some paths.',
    limits: 'Size and complexity limits for files and functions, with values per language.',
    naming: 'Banned words, case, and length for the names of files, folders, and identifiers, with values per language.',
    cloudflare: 'The file that holds the generated Cloudflare binding types, and its interface name.',
    coverage: 'The lowest test coverage that the test checks accept.',
    dependencies:
        'How many days a new release waits before an install picks it up, and the registries that lockfiles may use.',
    docs: 'Headings that documentation may not use, and URLs that the link check accepts.',
    drizzle: 'The names of Drizzle clients in your code.',
    licenses: 'The licenses that dependencies may have, and single packages accepted with a reason.',
    openapi: 'The committed OpenAPI document, and the command that generates it.',
    postgres: 'The migrations folder, the schemas that clients read, and the migrations that may not change.',
    secrets: 'The env example files, and the functions in your code that read environment variables.',
    site: 'How the site builds, where the built files go, and the size limits of its files.',
    spelling: 'The language of the spelling check, such as en-us or en-gb.',
    supabase: 'The folders of Supabase edge functions, the schemas, and the generated types file.',
    translations: 'The base locale and the folder of message files.',
    swift: 'The Xcode project, scheme, and destination that the Swift build uses.',
    repository: 'The largest file that Git may track, in kilobytes.',
    prose: 'The longest sentence, list item, and paragraph that the prose check accepts.',
    duplication: 'The smallest copy, in lines and tokens, that the duplication check reports.',
    xcode: 'The entitlements that an Xcode project may request.',
    tools: 'Options for single tools, such as lint rule options. gspot writes them into the tool files.',
    ignore: 'Checks and lint rules turned off for some paths or everywhere, each with a reason.',
    command_check: 'Your own commands, run as checks with a stage, a file list, and an output format.',
    structure:
        'Whether files may re-export the exports of other files, and which files may read environment variables.',
    hooks: 'Whether gspot install turns on the Git hooks.',
    ci: 'Whether gspot writes a CI workflow, for which provider, and on which systems it runs.',
    rules: 'Whether gspot writes rules for coding agents, and which rule files it leaves out.',
};

export const SETTING_RULES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    eslint: {
        'sonarjs/no-identical-functions': 'duplication.min_lines',
        'no-restricted-imports': 'tools.eslint.restricted_imports',
        'gspot/import-boundaries': '[[import_rule]]',
        'barrel-files/avoid-barrel-files': 'structure.reexports',
        'gspot/no-trivial-functions': 'limits.trivial_function_statements',
        'gspot/no-trivial-files': 'limits.trivial_function_statements',
        'n/file-extension-in-import': 'tools.eslint.import_extension',
    },
    markdownlint: { MD007: 'format.indent_width' },
};

/** A formatting override includes paths and at least one option. */
export const FORMAT_OVERRIDE_MIN_FIELDS = 2;

export const SETTING_TYPES = ['number', 'string', 'path', 'boolean', 'list', 'table'] as const;

export const PATH_ROLES = ['source', 'destination', 'build'] as const;

/** An exact package version such as 2.0.0.post1, a semver range such as ^1.2.0 or >=1 <2, or * for every version. */
export const ALLOWED_VERSION = /^(?:\*|\d[^\s@<>=~^*|,]*|[\d.xX*^~<>=|\s-]+)$/u;
