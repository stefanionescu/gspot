import type { Manifest, SettingDeclaration } from '#cli/types/configurations.ts';

export const ISO_DATE_LENGTH = 10;

// ESLint option arrays omit the severity; coverage and severity come from generated rule declarations.
export const ESLINT_OPTION_STRING = /^(?!(?:off|warn|error)$)[\s\S]*$/u;

export const ESLINT_OPTIONS_HELP =
    'ESLint rule selection comes from level recommended or all. Write only native options in an array, without a severity. Accept a finding with gspot ignore javascript/eslint --rule <rule> --reason "<why>".';

export const MARKDOWNLINT_OPTIONS_HELP =
    'Markdownlint rule selection comes from level recommended or all. Write only native option tables by Markdown rule ID, such as MD024. Accept a finding with gspot ignore markdown/markdownlint --rule <rule> --reason "<why>".';

export const STYLELINT_OPTIONS_HELP =
    'Stylelint rule selection comes from level recommended or all. Write native options only for active rules. Severity remains error; accept a finding with gspot ignore css/stylelint --rule <rule> --reason "<why>".';

export const COMMITLINT_OPTIONS_HELP =
    'Commitlint rule selection comes from level recommended or all. Write native options as ["always" or "never", optional value], without a severity. Accept a finding with gspot ignore commits/commitlint --rule <rule> --reason "<why>".';

export const YAML_OPTIONS_HELP =
    'Yamllint rule selection comes from level recommended or all. Write native option tables for active rules. Severity remains error; record exclusions with gspot ignore. Set indentation width under format. Accept a finding with gspot ignore files/yamllint --rule <rule> --reason "<why>".';

// A category key has two parts after the language: naming.<language>.<category>.<setting>.
export const CATEGORY_KEY_PARTS = 2;

/** The execution deadline applies independently of selected language configurations. */
export const TOOL_DEADLINE = {
    name: 'tool_timeout_seconds',
    validation: {},
    type: 'number',
    direction: 'ceiling',
    default: 600,
    summary: 'The longest one tool run can take, in seconds. gspot stops a longer run and reports an error.',
} as const satisfies SettingDeclaration;

/** A tool setting key is tools.<tool>.<slot>: two segments before the slot. */
export const TOOL_KEY_DEPTH = 2;

/** A scoped setting starts after scope and its literal authored map key. */
export const SCOPE_KEY_DEPTH = 2;

// A problem on one of these fields belongs to the entry or key that holds the field, and reading drops that owner.
export const FIELD_PROBLEMS = new Set(['reason', 'paths', 'path', 'basePath', 'module', 'group']);

export const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);

export const OVERRIDING_KINDS = new Set<Manifest['configuration']['kind']>([
    'framework',
    'platform',
    'library',
    'database',
]);

export const REASON_WORDS_MIN = 2;

export const INDENT_MAX = 8;

export const PRINT_WIDTH_MIN = 40;

export const PRINT_WIDTH_MAX = 400;

/** Where a test file lives: in a test folder, or named for a test runner. */
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
];

/** The files the managed block tells the reader to open first; they cannot be left out. */
export const FIRST_READ = ['general/engineering/agent/WORKING.md', 'general/engineering/prose/WRITING.md'];
