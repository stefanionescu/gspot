import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { findFileTarget } from '#tests/setup/cli/config-files.ts';

export const RECOMMENDED_VALE_FILES = [
    findFileTarget('prose', 'styles/gspot/alt-text.yml'),
    findFileTarget('prose', 'styles/gspot/dates.yml'),
    findFileTarget('prose', 'styles/gspot/link-text.yml'),
    findFileTarget('prose', 'styles/LICENSES.md'),
    GSPOT_PATHS.valeConfigFile,
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
