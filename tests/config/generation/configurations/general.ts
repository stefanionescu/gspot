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
    { source: 'from package import \\\n    (first,\n     second)\n', expected: '' },
    { source: 'import os; calculate_total()\n', expected: '; calculate_total()' },
    {
        source: 'description = "Users import packages to calculate totals"\n',
        expected: 'description = "Users import packages to calculate totals"',
    },
    { source: 'from package import first\ncalculate_total()\n', expected: 'calculate_total()' },
] as const;

export const EDITORCONFIG_SELECTOR_ERRORS = [
    {
        pattern: 'src/*.+(ts|js)',
        message:
            'EditorConfig cannot represent selector "src/*.+(ts|js)". Keep this override in a `[[format.override]]` record with a selector that EditorConfig can read.',
    },
] as const;

export const PROSE_STYLE_CASES = [
    {
        name: 'sentence-length',
        expected: { scope: 'sentence', max: 17, message: 'A sentence longer than 17 words. Split it.' },
    },
] as const;
