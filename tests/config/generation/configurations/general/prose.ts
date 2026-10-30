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
