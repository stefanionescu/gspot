import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';

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
