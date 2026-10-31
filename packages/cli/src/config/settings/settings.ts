import type { Check } from '#cli/types/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';

export const OVERRIDING_GROUPS = new Set<string>(['framework', 'platform', 'library', 'database']);

export const OPENNEXT_PACKAGE = '@opennextjs/cloudflare';

export const OPENNEXT_TYPE_DEFAULTS = {
    'cloudflare.types_file': 'cloudflare-env.d.ts',
    'cloudflare.types_interface': 'CloudflareEnv',
} as const;

export const BUILD_SCRIPT = ['run', 'build'] as const;

export const CI_PROVIDERS = ['github', 'gitlab'] as const;

export const GITHUB_ONLY_CI_KEYS = ['operating_systems', 'linux_runner'] as const;

export const SETTINGS_FILE = 'gspot.toml';

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

export const NO_CHECK_PATHS_MESSAGE = 'An ignore without check needs paths.';

export const NO_CHECK_RULE_MESSAGE = 'An ignore without check cannot name a rule. Add the check that owns the rule.';

export const NO_SETTINGS_MESSAGE = 'There is no gspot.toml here. Run gspot init to create one.';

export const SETTINGS_ENCODING_MESSAGE = 'gspot.toml must contain valid UTF-8 text.';

export const COMMAND_CHECK_ID = /^[^\s,]+$/u;

export const TOML_FORMAT = { inlineTableStart: 1, bracketSpacing: false, trailingComma: false } as const;

export const SETTINGS_PREFACE = /^(?:# Change these settings[^\n]*\n)?/u;

export const OWN_FILES_ONLY = 'only its own files';

export const CATEGORY_KEY_SEGMENTS = 2;

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

export const COMMAND_CHECK_DEFAULTS = {
    level: 'basic',
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
} satisfies Pick<Check, 'level' | 'runs'> & {
    files: Omit<NonNullable<Check['files']>, 'paths'>;
};

export const COMMAND_CHECK_WHY = 'This repository runs this command as one of its checks.';

export const COMMAND_CHECK_HELP = 'Read the command output; this repository declares the check.';

export const NO_ROOT_SCOPE_MESSAGE = 'The scopes hold no repository root.';

export const ALLOWED_WORD = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_]*(?:[-'\u{2019}][\p{L}\p{M}\p{N}_]+)*$/u;

export const SPELLING_LOCALES = ['en', 'en-us', 'en-gb', 'en-au', 'en-ca'] as const;

export const REEXPORT_MODES = ['none', 'index-only'] as const;

export const ROOT_KEYS = [
    'level',
    'configurations',
    'removed_configurations',
    'test_files',
    'tool_timeout_seconds',
] as const;

export const FIRST_TABLES = [
    'hooks',
    'ci',
    'rules',
    'format',
    'limits',
    'naming',
    'structure',
    'dependencies',
    'docs',
    'licenses',
    'spelling',
] as const;

export const LAST_TABLES = ['tools', 'scope', 'import_rule', 'command_check', 'ignore'] as const;
