import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

/** The settings file of a repository. */
export const SETTINGS_FILE = 'gspot.toml';

/** The first line of gspot.toml: editors validate the file with the schema of the pinned gspot. */
export const SCHEMA_DIRECTIVE = `#:schema ./${GSPOT_PATHS.settingsSchema}`;

/** A schema directive on the first line, with its line break. */
export const SCHEMA_DIRECTIVE_LINE = /^#:schema [^\n]*\n?/u;

/**
 * toml-patch starts a parse error with its location, the source line, and a caret; gspot drops these lines and names
 * the location itself.
 */
export const PARSE_CONTEXT_LINES = 3;
/** Complete written examples for the editor schema and the settings reference. */
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
export const NAMED_FINDING_CHECKS: ReadonlySet<string> = new Set(['structure/trivial-functions', 'python/vulture']);
