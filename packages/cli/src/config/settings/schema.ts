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
    { rules: { enabled: true, instruction_files: ['.github/copilot-instructions.md'] } },
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
export const IMPORT_EXTENSIONS = ['js', 'ts', 'extensionless'] as const;
export const DOCSTRING_CONVENTIONS = ['google', 'numpy', 'pep257'] as const;
export const RULE_CONDITIONS = ['always', 'never'] as const;

export const ALLOWED_WORD = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_]*(?:[-'’][\p{L}\p{M}\p{N}_]+)*$/u;

export const KNIP_PACKAGE_NAME = /^[^*+\\(|{^$\s]+$/u;

export const NAMING_TABLE_CATEGORIES = [
    'files',
    'directories',
    'types',
    'functions',
    'parameters',
    'variables',
    'properties',
] as const;

export const SETTING_FIELDS = {
    eslinttable_import_extension: {
        configurations: ['javascript'],
        description:
            'The import suffix used in this scope: js for compiled ESM, ts for Deno and Bun, extensionless for bundled code.',
    },
    eslinttable_restricted_imports: {
        configurations: ['javascript'],
        description: 'Imports this repository refuses, each with a name, and a message.',
    },
    eslinttable_rules: {
        configurations: ['javascript'],
        description:
            'Option arrays by ESLint rule ID, without a severity. Options apply only where the selected level enables the rule. Accept findings with gspot ignore --rule.',
    },
    eslinttable_override: {
        configurations: ['javascript'],
        description: 'Rule options for repository-relative paths, in order. Explicit ignores apply last.',
    },
    hadolint_trusted_registries: {
        configurations: ['docker'],
        description: 'The registries a base image may come from; empty allows any.',
    },
    nginx_image: {
        configurations: ['nginx'],
        description: 'The image nginx -t runs in; name the one the deployment uses.',
    },
    ruff_docstring_convention: {
        configurations: ['python'],
        description:
            'The Ruff pydocstyle convention carried from project configuration, also used by pydoclint when it has no explicit style.',
    },
    semgrep_registry_packs: {
        configurations: ['security'],
        description: 'The registry packs the manual registry check runs.',
    },
    semgrep_rule_files: {
        configurations: ['security'],
        description: 'Rule files or folders of the repository that Semgrep runs beside the shipped packs.',
    },
    sqlfluff_dialect: {
        configurations: ['sql'],
        description: 'The sqlfluff dialect; a database configuration sets it.',
    },
    swiftlint_always_keep_imports: {
        configurations: ['swift'],
        description: 'Imports the analyzer keeps although it sees no use of them.',
    },
    trivy_severity: {
        configurations: ['docker'],
        description: 'The severities Trivy reports.',
    },
    commitlint_types: {
        configurations: ['commits'],
        description: 'The commit types the type-enum rule allows.',
    },
    commitlint_scopes: {
        configurations: ['commits'],
        description:
            'Optional commit scopes accepted by the scope-enum rule. Empty derives exact names from the last segment of each project scope path; a repository with no project scopes gets no enum. A message can omit its scope.',
    },
    commitlint_rules: {
        configurations: ['commits'],
        description:
            'Options for active commitlint rules, by rule name: an always/never condition and optional value, without a severity. The level decides which rules run. Ignore a finding with gspot ignore commits/commitlint --rule `<rule>` --reason `<why>`.',
        offValues: [0],
    },
    yamllint_rules: {
        configurations: ['files'],
        description:
            'Option tables for active YAML rules. The level decides which rules run, and formatting width comes from [format]. Ignore a finding with gspot ignore files/yamllint --rule `<rule>` --reason `<why>`.',
        offValues: ['disable'],
    },
    markdownlint_rules: {
        configurations: ['markdown'],
        description:
            'Option tables by Markdown rule ID, such as MD024. The level decides which rules run; ignore a finding with gspot ignore markdown/markdownlint --rule `<rule>` --reason `<why>`.',
        offValues: [false],
    },
    stylelint_rules: {
        configurations: ['css'],
        description:
            'Options for Stylelint rules active at recommended or all. Severity remains error; accept a finding with gspot ignore css/stylelint --rule `<rule>` --reason `<why>`.',
    },
    squawk_assume_in_transaction: {
        configurations: ['postgres'],
        description:
            'Whether the migration runner wraps every migration in a transaction; the supabase configuration turns it on.',
    },
    knip_entry: {
        configurations: ['javascript'],
        description: 'Entry points knip starts from beyond the ones the framework configuration declares.',
    },
    knip_ignore_dependencies: {
        configurations: ['javascript'],
        description:
            'Exact package names knip does not report as unused. Adding names needs a reason; a scope list applies to that project.',
        reason_needed: 'adding',
    },
    purgecss_safelist: {
        configurations: ['site'],
        description: 'Class names a script adds at run time: the names and the reason.',
        reason_needed: 'adding',
    },
    v8r_schema: {
        configurations: ['files'],
        description:
            'File patterns mapped to schema URLs, for files the SchemaStore catalog does not know; each entry has a pattern and a schema.',
    },
    max_characters: {
        configurations: ['naming'],
        description: 'The most characters one identifier may have.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript', 'python', 'bash', 'swift', 'sql'],
        categories: NAMING_TABLE_CATEGORIES,
        language_defaults: { swift: 40, sql: 55 },
    },
    max_words: {
        configurations: ['naming'],
        description: 'The most words one identifier may have.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript', 'python', 'bash', 'swift', 'sql'],
        categories: NAMING_TABLE_CATEGORIES,
        language_defaults: { swift: 5, sql: 7 },
    },
    cases: {
        configurations: ['naming'],
        description:
            'The case patterns one identifier category accepts: camel, pascal, kebab, snake, upper-snake, pascal-extension (String+Format.swift) and timestamp-snake (20260103120000_create_users.sql). Ruff owns the case of Python classes, functions, and parameters, and SwiftLint owns Swift types, variables, parameters, and enum cases; these settings choose the case for every other category.',
        reason_needed: 'adding',
        languages: ['typescript', 'javascript', 'python', 'swift', 'bash', 'sql'],
        categories: NAMING_TABLE_CATEGORIES,
    },
} as const;

export const EXTRA_OPTIONS_DESCRIPTION = 'Extra options passed to the tool as written.';
