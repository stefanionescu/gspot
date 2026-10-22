export const RECOMMENDED_VALE_FILES = [
    '.gspot/configurations/general/prose/styles/gspot/alt-text.yml',
    '.gspot/configurations/general/prose/styles/gspot/dates.yml',
    '.gspot/configurations/general/prose/styles/gspot/link-text.yml',
    '.gspot/configurations/general/prose/styles/LICENSES.md',
    '.gspot/configurations/general/prose/vale.ini',
] as const;

/** Settings with a reviewed product word in a scope. */
export const PRODUCT_WORD_SETTINGS = {
    level: 'all',
    tables: '[spelling.allowed_words]\nNebulaProduct = "The project uses this reviewed product name."\nPython = "The project uses this reviewed language name."\n',
    scopes: [
        { path: 'app', configurations: ['python'] },
        { path: 'sibling', configurations: [] },
    ],
} as const;
