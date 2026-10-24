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

export const PROSE_STYLE_CASES = [
    {
        name: 'heading-case',
        expected: {
            scope: 'heading.h2',
            match: '$sentence',
            message: "Write headings below the title in sentence case: '%s'.",
        },
    },
    {
        name: 'title-case',
        expected: { scope: 'heading.h1', match: '$title', message: "Write the document title in title case: '%s'." },
    },
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
