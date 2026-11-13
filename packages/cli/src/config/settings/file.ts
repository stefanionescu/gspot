import { DOCS_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import type { Check } from '#cli/types/manifests.ts';

// command checks
export const COMMAND_CHECK_DEFAULTS = {
    level: 'basic',
    files: {
        extensions: [],
        filenames: [],
        tags: [],
        languages: false,
        test_files: false,
        prettier_plugins: false,
        eslint_plugins: false,
        kinds: ['source', 'generated'],
    },
} satisfies Pick<Check, 'level'> & {
    files: Omit<NonNullable<Check['files']>, 'paths'>;
};
export const COMMAND_CHECK_HELP = 'Read the command output; this repository declares the check.';
export const COMMAND_CHECK_WHY = 'This repository runs this command as one of its checks.';

// file layout
export const FIRST_TABLES = [
    'hooks',
    'ci',
    'rule_files',
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
export const ROOT_KEYS = [
    'level',
    'configurations',
    'removed_configurations',
    'test_files',
    'tool_timeout_seconds',
] as const;
export const SETTINGS_PREFACE = /^(?:# Change these settings[^\n]*\n(?:# Run gspot list settings[^\n]*\n)?)?/u;
export const SETTINGS_PREFACE_LINES = [
    '# Change these settings with `gspot set`, `unset`, `ignore`, or `unignore`, and the configurations with `gspot add` or `remove`.',
    '# Run gspot list settings to see each setting. Records such as [[scope]] and [[command_check]] are written by hand.',
] as const;
export const TOML_FORMAT = { inlineTableStart: 1, bracketSpacing: false, trailingComma: false } as const;

// file read
export const NO_SETTINGS_MESSAGE = 'There is no gspot.toml here. Run gspot init to create one.';
export const SETTINGS_ENCODING_MESSAGE = 'gspot.toml must contain valid UTF-8 text.';

// ignore paths
export const ESCAPED_GLOB_CHARACTERS = /\\([()[\]{}*?!+@])/gu;

// levels
export const ALL_LEVEL_SUMMARY =
    'Level all adds stricter rules, which can flag correct code or enforce a style preference.';
export const LEVEL_SUMMARY =
    'Level basic checks for bugs, security problems, code style, broken docs and config, formatting, and a reason on each suppression.';

// records
export const NO_CHECK_PATHS_MESSAGE = 'An ignore without check needs paths.';
export const NO_ROOT_SCOPE_MESSAGE = 'The scopes hold no repository root.';
export const RECORD_PATHS_MESSAGE = ' Its paths say where it applies.';
export const WEAKENINGS_CHECK = 'gspot/weakenings';
export const WEAKENINGS_IGNORE_MESSAGE = `An ignore of ${WEAKENINGS_CHECK} names one rule, so that the check keeps running.`;

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

// settings page
export const SETTINGS_PAGE_SENTENCE = `${DOCS_PATHS.settings} lists every setting.`;

// settings reference
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
export const SETTING_NAME_PLACEHOLDER = '<name>';
