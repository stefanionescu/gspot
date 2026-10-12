export const ISO_DATE_LENGTH = 10;

// A category key has two parts after the language: naming.<language>.<category>.<setting>.
export const CATEGORY_KEY_PARTS = 2;

export const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);

export const OVERRIDING_KINDS = new Set<string>(['framework', 'platform', 'library', 'database']);

export const REASON_WORDS_MIN = 2;

export const SETTING_TYPES = ['number', 'string', 'path', 'boolean', 'list', 'table'] as const;
export const PATH_ROLES = ['source', 'destination'] as const;
export const REASON_NEEDED = ['raising', 'lowering', 'adding'] as const;

export const ALL_LANGUAGES = '*';
export const GSPOT_DEFAULT_SOURCE = 'gspot';
export const COMMAND_CHECK_DEFAULTS = {
    level: 'recommended',
    runs: 'files',
    files: {
        extensions: [],
        filenames: [],
        tags: [],
        languages: false,
        prettier_plugins: false,
        eslint_plugins: false,
        kinds: ['source', 'generated'],
    },
} as const;

export const TOOL_TIMEOUT_SETTING = 'tool_timeout_seconds';

export const ENV_ROLE = 'environment_readers';

export const TABLE_FIELDS = {
    allowed: {
        configurations: ['licenses'],
        description: 'The SPDX license ids a dependency may report.',
    },
    allowed_package: {
        configurations: ['licenses'],
        description: 'Packages accepted under a license outside the list: name, exact version, and reason.',
    },
    reexports: {
        configurations: ['structure'],
        reason_needed: 'adding',
        description: 'Whether re-exports are allowed: none, or an index file that re-exports other files.',
    },
    cloudflare_types_file: {
        configurations: ['cloudflare'],
        description: 'Tracked Worker environment types file, relative to the repository root.',
    },
    types_interface: {
        configurations: ['cloudflare'],
        description: 'Environment interface name passed to wrangler types; OpenNext uses CloudflareEnv.',
    },
    lines: {
        configurations: ['coverage'],
        description: 'The minimum percentage of source lines covered by tests.',
        default_all: 80,
        reason_needed: 'lowering',
    },
    branches: {
        configurations: ['coverage'],
        description: 'The minimum percentage of source branches covered by tests.',
        default_all: 80,
        reason_needed: 'lowering',
    },
    functions: {
        configurations: ['coverage'],
        description: 'The minimum percentage of source functions covered by tests.',
        default_all: 80,
        reason_needed: 'lowering',
    },
    statements: {
        configurations: ['coverage'],
        description: 'The minimum percentage of source statements covered by tests.',
        default_all: 80,
        reason_needed: 'lowering',
    },
    target: {
        configurations: ['coverage'],
        description: 'Line coverage floors for named Swift targets.',
    },
    min_release_age_days: {
        configurations: ['dependencies'],
        description: 'The minimum age in days for releases installed through Bun.',
        reason_needed: 'lowering',
    },
    allowed_registries: {
        configurations: ['dependencies'],
        description: 'The hosts a lockfile may resolve packages from.',
        reason_needed: 'adding',
    },
    scanner: {
        configurations: ['dependencies'],
        description: 'The security scanner package Bun runs on install. When absent, no scanner is required.',
    },
    banned_headings: {
        configurations: ['docs'],
        description: 'Headings this repository bans beyond the shipped list.',
    },
    allowed_urls: {
        configurations: ['docs'],
        description: 'Allowed URL patterns; additions need a reason for the whole list.',
        reason_needed: 'adding',
    },
    client_names: {
        configurations: ['drizzle'],
        description: 'The Drizzle client identifiers checked for update and delete operations without a where clause.',
    },
    templates: {
        configurations: ['html'],
        description: 'The HTML files that are templates filled from content; empty turns the copy check off.',
    },
    document: {
        configurations: ['openapi'],
        description:
            'The committed OpenAPI document, relative to the repository root. Init writes a detected document; when absent, OpenAPI checks do not run.',
    },
    generate_command: {
        configurations: ['openapi'],
        description: 'The command that writes the OpenAPI document from the code, run in the project scope folder.',
    },
    client_schemas: {
        configurations: ['postgres'],
        description: 'The schemas clients reach, where every table needs row level security.',
    },
    frozen_through: {
        configurations: ['postgres'],
        description:
            'The version through which migrations have run everywhere: none, all, or a version. Squawk skips them, and they may not change.',
    },
    migrations_folder: {
        configurations: ['postgres'],
        description:
            'The migrations folder relative to the repository root. When absent, use the migration files this configuration owns.',
    },
    env_examples: {
        configurations: ['secrets'],
        description:
            'The example environment filenames searched for supported environment keys; a key may appear in any one example file.',
    },
    reader_functions: {
        configurations: ['secrets'],
        description:
            'The project functions that read environment keys, in addition to the built-in readers; for example config.$env and read_env.',
    },
    build_command: {
        configurations: ['site'],
        description: 'The build script run by the repository package manager, unless your own command replaces it.',
    },
    build_folder: {
        configurations: ['site'],
        description: 'The folder the build writes.',
    },
    allowed_unlisted_pages: {
        configurations: ['site'],
        description: 'Built pages the sitemap leaves out on purpose.',
        reason_needed: 'adding',
    },
    size_limit: {
        configurations: ['site'],
        description: 'Weight ceilings: the built paths, and the most kilobytes they may weigh compressed.',
    },
    locale: {
        configurations: ['prose'],
        description: 'The English locale typos checks against: en, en-us, en-gb, en-ca, or en-au.',
    },
    functions_folder: {
        configurations: ['supabase'],
        description:
            'The folder relative to the repository root that holds one folder for each edge function. The default is relative to the project scope.',
    },
    schemas: {
        configurations: ['supabase'],
        description: 'The database schemas to include in generated types.',
    },
    supabase_types_file: {
        configurations: ['supabase'],
        description:
            'The committed database types file, relative to the repository root. When absent, no type comparison runs.',
    },
    base_locale: {
        configurations: ['translations'],
        description: 'The locale whose message keys every other locale must contain.',
    },
    messages_folder: {
        configurations: ['translations'],
        description: 'The folder of `<locale>`.json message files, relative to the repository root.',
    },
    indent_style: {
        configurations: ['format'],
        description: 'What one indent level is made of: space or tab.',
    },
    indent_width: {
        configurations: ['format'],
        description: 'Spaces per indent level.',
    },
    print_width: {
        configurations: ['format'],
        description: 'The line width formatters wrap at.',
    },
    line_ending: {
        configurations: ['format'],
        description: 'The line ending every file uses: lf or crlf.',
    },
    final_newline: {
        configurations: ['format'],
        description: 'Whether every file ends with a newline.',
    },
    quotes: {
        configurations: ['format'],
        description: 'single or double, for the languages where a formatter chooses.',
    },
    trailing_commas: {
        configurations: ['format'],
        description: 'Where trailing commas go: all, es5, or none.',
    },
    semicolons: {
        configurations: ['format'],
        description: 'Whether JavaScript and TypeScript statements end with semicolons.',
    },
    formatschema_override: {
        configurations: ['format'],
        description: 'Formatting options for repository-relative paths, in order.',
    },
} as const;

export const SETTINGS_DESCRIPTIONS = {
    configurations:
        'Configurations you chose by hand, on top of the ones gspot detects. `gspot add` writes it; `gspot set` refuses it.',
    removed_configurations:
        'Configurations you removed; detection does not add them back. Only `gspot add` and `gspot remove` write it; `gspot set` and `gspot unset` refuse it.',
    'ci.enabled': 'Write a CI workflow. Root only.',
    'ci.provider': 'Which CI gets the workflow. Root only.',
    'ci.setup_command': 'A command CI runs before `gspot install`, such as `npm ci`. Root only.',
    'scope.path': 'The folder. Two records may not name the same folder.',
    'scope.configurations': 'Configurations for this folder, on top of the root ones. `gspot add --scope` writes it.',
    'scope.removed_configurations':
        'Configurations removed in this folder. Only `gspot add` and `gspot remove` write it.',
    'scope.test_files': 'More test files for this folder. Adds to the root list.',
} as const;

/** Scoped single-value tables omit root records while retaining their normalized list fields. */
export const SCOPE_EMPTY_RECORDS = [
    ['naming', 'override'],
    ['coverage', 'target'],
    ['docs', 'banned_headings'],
    ['licenses', 'allowed_package'],
    ['site', 'size_limit'],
] as const;
