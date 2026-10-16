export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

export const SETTING_LANGUAGES = ['typescript', 'javascript', 'python', 'bash', 'swift', 'sql', 'css', 'html'] as const;

export const ESLINT_OPTION_STRING = /^(?!(?:off|warn|error)$)[\s\S]*$/u;

export const ESLINT_OPTIONS_HELP =
    'ESLint rule selection comes from level recommended or all. Write only options in an array, without a severity. Accept a finding with gspot ignore javascript/eslint --rule <rule> --reason "<why>".';

export const MARKDOWNLINT_OPTIONS_HELP =
    'Markdownlint rule selection comes from level recommended or all. Write only option tables by Markdown rule ID, such as MD024. Accept a finding with gspot ignore markdown/markdownlint --rule <rule> --reason "<why>".';

export const STYLELINT_OPTIONS_HELP =
    'Stylelint rule selection comes from level recommended or all. Write options only for active rules. Severity remains error; accept a finding with gspot ignore css/stylelint --rule <rule> --reason "<why>".';

export const COMMITLINT_OPTIONS_HELP =
    'Commitlint rule selection comes from level recommended or all. Write options as ["always" or "never", optional value], without a severity. Accept a finding with gspot ignore commits/commitlint --rule <rule> --reason "<why>".';

export const YAMLLINT_OPTIONS_HELP =
    'Yamllint rule selection comes from level recommended or all. Write option tables for active rules. Severity remains error; record exclusions with gspot ignore. Set indentation width under format. Accept a finding with gspot ignore files/yamllint --rule <rule> --reason "<why>".';

export const INDENT_MAX = 8;

export const PRINT_WIDTH_MIN = 40;

export const PRINT_WIDTH_MAX = 400;

export const DEFAULT_TEST_PATTERNS = [
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/test_*.py',
    '**/*_test.py',
    '**/conftest.py',
    '**/Tests/**',
    '**/*Tests.swift',
] as const;

export const LEVEL_SUMMARY =
    "Correctness, security, accessibility, type safety, routine formatting, and the project's own declared checks apply at both levels.";

export const ALL_LEVEL_SUMMARY =
    'Level `all` adds checks and rules for word choice, architecture, naming, doc comments, declaration order, API style, and complexity. No level turns on experimental or preview lint rules.';

export const RULE_TOKEN = '<rule>';

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
    { architecture: { roles: { environment_readers: ['src/environment.ts'] } } },
    {
        structure: {
            reexports: { value: 'index-only', reason: 'The library uses index files to publish its public API.' },
        },
    },
    { configurations: ['javascript'], tools: { eslint: { rules: { 'no-console': [{ allow: ['warn'] }] } } } },
    { format: { indent_width: 4, print_width: 100 } },
    { dependencies: { min_release_age_days: 7 } },
    { allowed_words: { value: ['Acme'], reason: 'The project uses this product name.' } },
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
    { architecture: { module: [{ name: 'core', paths: ['src/core/**'], may_import: [] }] } },
    {
        tools: {
            prettier: {
                extra: { value: { proseWrap: 'always' }, reason: 'Documentation uses reviewed paragraph wrapping.' },
            },
        },
    },
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

export const NAMING_TABLE_CATEGORIES = [
    'files',
    'folders',
    'types',
    'functions',
    'parameters',
    'variables',
    'properties',
] as const;

export const EXTRA_OPTIONS_DESCRIPTION = 'Extra options passed to the tool as written.';

export const INTERNAL_SCHEMA_METADATA = [
    'configurations',
    'reason_needed',
    'language_defaults',
    'pathRole',
    'default_all',
    'off_values',
] as const;
