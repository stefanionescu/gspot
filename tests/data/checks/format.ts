import { buildSandboxSettings } from '#tests/setup/settings.ts';

/** Only the EditorConfig check reads the format settings. */
export const EDITORCONFIG_SETTINGS = `configurations = ["format"]
[[ignore]]
check = "format/prettier"
reason = "This sandbox uses EditorConfig without Prettier."
[rules]
enabled = false
`;

/** EditorConfig findings that formatters do not replace. */
export const EDITORCONFIG_SAMPLES = [
    { file: 'line-endings.txt', broken: 'content\r\n', corrected: 'content\n' },
    { file: 'final-newline.txt', broken: 'content', corrected: 'content\n' },
    { file: 'trailing-whitespace.txt', broken: 'content \n', corrected: 'content\n' },
] as const;

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

/** Selectors that EditorConfig cannot express in a section. */
export const EDITORCONFIG_SELECTOR_ERRORS = [
    {
        pattern: 'src/*.+(ts|js)',
        message:
            'EditorConfig cannot represent selector "src/*.+(ts|js)". Keep this override in a `[[format.override]]` record with a selector that EditorConfig can read.',
    },
    {
        pattern: '!src/*.js',
        message:
            'EditorConfig cannot represent selector "!src/*.js". Keep this override in a `[[format.override]]` record with a selector that EditorConfig can read.',
    },
] as const;

export const PRETTIER_PATH_IGNORE = `
[[ignore]]
check = "format/prettier"
paths = ["**/*.json"]
reason = "These files retain generated formatting."
`;

export const NON_RECORD_JSON = ['null', '[]', '42'];

/** A staged format check uses the root tool file until a later apply writes the scope tool file. */
export const STAGED_FORMAT_FILES = {
    'gspot.toml': buildSandboxSettings(['format'], {
        tables: '[format]\nindent_width = 2\n[rules]\nenabled = false\n',
        scopes: [{ path: 'app' }],
    }),
    'app/value.js': 'export const value = {\n  value: {\n    active: true,\n  },\n};\n',
} as const;

export const STAGED_FORMAT_SOURCE = {
    staged: 'export const value = {\n  value: {\n    active: false,\n  },\n};\n',
    working: 'export const value = {\n    value: {\n        active: false,\n    },\n};\n',
} as const;

export const STAGED_FORMAT_PATHS = {
    source: 'app/value.js',
    rootConfig: '.gspot/configurations/general/format/prettier.json',
    scopeConfig: '.gspot/configurations/general/format/scopes/app/prettier.json',
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
