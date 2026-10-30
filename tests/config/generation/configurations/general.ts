export const MAPPED_SCHEMA_RECORDS = [
    {
        name: 'https://example.com/schema.json',
        fileMatch: ['custom.json'],
        location: 'https://example.com/schema.json',
    },
] as const;

export const MAPPED_SCHEMAS = [
    {
        paths: ['custom.json'],
        url: 'https://example.com/schema.json',
    },
] as const;

export const BUN_SCANNER_KEYS = [
    {
        path: 'apps/api/bunfig.toml',
        keys: [{ key: ['install', 'security', 'scanner'], value: '@socketsecurity/bun-security-scanner' }],
    },
];

export const PYTHON_IMPORT_EXCLUSIONS = [
    { source: 'import os\nimport pathlib as paths\n', expected: '' },
    { source: 'from .package import first as renamed, second\n', expected: '' },
    { source: 'from package import (\n    first as renamed,\n    second,\n)\n', expected: '' },
    { source: 'import first, \\\n    second as renamed\n', expected: '' },
    { source: 'from package \\\n    import first, \\\n    second\n', expected: '' },
    { source: 'from package import \\\n    (first,\n     second)\n', expected: '' },
    { source: 'import os; calculate_total()\n', expected: '; calculate_total()' },
    { source: 'from package import (first, second); calculate_total()\n', expected: '; calculate_total()' },
    {
        source: 'description = "Users import packages to calculate totals"\n',
        expected: 'description = "Users import packages to calculate totals"',
    },
    { source: '# Explain how to import packages\n', expected: '# Explain how to import packages' },
    { source: 'from package import first\ncalculate_total()\n', expected: 'calculate_total()' },
] as const;

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

export const DEFAULT_LEVEL_STYLE_FILES = [
    'styles/LICENSES.md',
    'styles/gspot/alt-text.yml',
    'styles/gspot/dates.yml',
    'styles/gspot/link-text.yml',
] as const;

export const PRODUCT_WORD_SETTINGS = {
    level: 'all',
    tables: '[spelling.allowed_words]\nNebulaProduct = "The project uses this reviewed product name."\nPython = "The project uses this reviewed language name."\n',
    scopes: [
        { path: 'app', configurations: ['python'] },
        { path: 'sibling', configurations: [] },
    ],
} as const;

export const PROSE_STYLE_CASES = [
    {
        name: 'item-length',
        expected: {
            scope: 'list',
            max: 11,
            message: 'A list item longer than 11 words. Split it or make it a paragraph.',
        },
    },
    {
        name: 'paragraph-length',
        expected: { scope: 'paragraph', max: 3, message: 'A paragraph longer than 3 sentences. Split it.' },
    },
    {
        name: 'sentence-length',
        expected: { scope: 'sentence', max: 17, message: 'A sentence longer than 17 words. Split it.' },
    },
] as const;

export const GSPOT_STYLES_LINE = 'BasedOnStyles = gspot';

export const BRITISH_SCOPE_SETTINGS = {
    level: 'all',
    tables: `[[scope]]
path = "british"
spelling.locale = "en-gb"
[[scope]]
path = "british/american"
spelling.locale = "en-us"
`,
} as const;
