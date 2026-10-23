import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';

export const RECOMMENDED_VALE_FILES = [
    findManifestTarget('prose', 'styles/gspot/alt-text.yml'),
    findManifestTarget('prose', 'styles/gspot/dates.yml'),
    findManifestTarget('prose', 'styles/gspot/link-text.yml'),
    findManifestTarget('prose', 'styles/LICENSES.md'),
    GSPOT_PATHS.valeConfigFile,
] as const;

export const PRODUCT_WORD_SETTINGS = {
    level: 'all',
    tables: '[spelling.allowed_words]\nNebulaProduct = "The project uses this reviewed product name."\nPython = "The project uses this reviewed language name."\n',
    scopes: [
        { path: 'app', configurations: ['python'] },
        { path: 'sibling', configurations: [] },
    ],
} as const;
