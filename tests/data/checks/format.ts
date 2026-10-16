/** Only the native EditorConfig check consumes formatting configuration. */
export const EDITORCONFIG_SETTINGS = `configurations = ["format"]
[[ignore]]
check = "format/prettier"
reason = "This sandbox uses EditorConfig without Prettier."
[rules]
enabled = false
`;

/** Native EditorConfig findings that formatters do not replace. */
export const EDITORCONFIG_SAMPLES = [
    { file: 'line-endings.txt', broken: 'content\r\n', corrected: 'content\n' },
    { file: 'final-newline.txt', broken: 'content', corrected: 'content\n' },
    { file: 'trailing-whitespace.txt', broken: 'content \n', corrected: 'content\n' },
] as const;

// The formatter overrides of a sandbox and what each file resolves to.
/** A policy with formatter overrides at the root, for a path, and in nested scopes. */
export const FORMAT_OVERRIDES_SETTINGS = `level = "all"\nconfigurations = ["format", "javascript"]\n[rules]\nenabled = false\n[format]\nindent_width = 2\nquotes = "double"\nsemicolons = false\n[[format.override]]\npaths = ["tests/**"]\nquotes = "single"\nsemicolons = true\n[[format.override]]\npaths = ["apps/web/**", "!apps/web/exempt.js"]\nquotes = "single"\n[[format.override]]\npaths = ["apps/web/admin/**"]\nquotes = "double"\nsemicolons = true\nline_ending = "crlf"\n[[scope]]\npath = "apps/web"\n[scope.format]\nindent_width = 4\n[[scope]]\npath = "apps/web/admin"\n[scope.format]\nindent_width = 8\n`;

/** Each test file and the Prettier options its overrides resolve to. */
export const PRETTIER_OPTIONS_BY_FILE = [
    { file: 'source.js', tabWidth: 2, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'tests/unit.js', tabWidth: 2, singleQuote: true, semi: true, endOfLine: 'lf' },
    { file: 'apps/web/café note.js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/[special].js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/exempt.js', tabWidth: 4, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/admin/page.js', tabWidth: 8, singleQuote: false, semi: true, endOfLine: 'crlf' },
] as const;

/** Source files outside the Prettier extension set still receive EditorConfig checks. */
export const EDITORCONFIG_FILES = {
    'source.py': 'VALUE = 1\n',
    'task.sh': '#!/bin/sh\nprintf hello\n',
    'Source.swift': 'let value = 1\n',
    'settings.toml': 'value = 1\n',
    'query.sql': 'SELECT 1;\n',
    Makefile: 'build:\n\ttrue\n',
    Dockerfile: 'FROM scratch\n',
} as const;

export const FORMAT_SETTINGS = `configurations = ["format"]
[rules]
enabled = false
`;

export const PRETTIER_PATH_IGNORE = `
[[ignore]]
check = "format/prettier"
paths = ["**/*.json"]
reason = "These files retain generated formatting."
`;

export const NON_RECORD_JSON = ['null', '[]', '42'];

/** A staged formatter keeps its root target before a later apply writes a scoped target. */
export const STAGED_FORMAT_FILES = {
    'gspot.toml': `configurations = ["format"]
[format]
indent_width = 2
[[scope]]
path = "app"
[rules]
enabled = false
`,
    'app/value.js': 'export const value = {\n  value: {\n    active: true,\n  },\n};\n',
} as const;

export const STAGED_FORMAT_SOURCE = {
    staged: 'export const value = {\n  value: {\n    active: false,\n  },\n};\n',
    working: 'export const value = {\n    value: {\n        active: false,\n    },\n};\n',
} as const;

export const STAGED_FORMAT_PATHS = {
    source: 'app/value.js',
    rootConfig: '.gspot/config/prettier.json',
    scopeConfig: '.gspot/config/prettier/app/prettier.json',
    settings: 'gspot.toml',
} as const;

export const STAGED_FORMAT_CHANGE_ARGUMENTS = ['set', 'format.indent_width', '4', '--scope', 'app'] as const;

export const STAGED_FORMAT_CHECK_ARGUMENTS = [
    'check',
    '--staged',
    '--only',
    'format/prettier',
    '--json',
    '--',
    'app/value.js',
] as const;
