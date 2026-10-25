import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const VALE_PACKAGES = ['Google', 'write-good', 'proselint', 'alex', 'Harper'] as const;

export const VALE_PACKAGE_RELEASES = {
    Google: { version: 'v0.7.1', sha256: '4b67fca1f2a88595b2a578ab98bbf3017a23af677b04f93e862843f3ea1a9a0b' },
    'write-good': { version: 'v0.4.1', sha256: '2960ef10861ddc7dc76292a4967eb3789bf05ca24f862042f6d15f53332887f0' },
    proselint: { version: 'v0.3.4', sha256: '48b1fb481ba44f6505d44346b283f6cdc74efd234f913bbdb09bf34420fab81c' },
    alex: { version: 'v0.2.3', sha256: '44014c7f63d4a8bce86788e074edb80333a9b6eba07e5dd27b24823b69eed50b' },
    Harper: { version: 'v0.1.0', sha256: 'bfab282e7abd8906f8656c240ccd4d873679878ed8e0c42d683ad7e2798c436c' },
} as const;

export const VALE_PACKAGE_REPOSITORY = 'https://github.com/vale-cli/';

export const VALE_REGEX_SYMBOLS = /[.*+?^${}()|[\]\\/-]/gu;

export const CAPITALIZATION_STYLES = {
    heading: {
        message: "Write headings below the title in sentence case: '%s'.",
        scope: 'heading.h2',
        match: '$sentence',
    },
    title: { message: "Write the document title in title case: '%s'.", scope: 'heading.h1', match: '$title' },
} as const;

export const LENGTH_STYLES = {
    item: {
        extends: 'occurrence',
        scope: 'list',
        token: String.raw`\b\w+\b`,
        setting: 'max_list_item_words',
        message: 'A list item longer than {{max}} words. Split it or make it a paragraph.',
    },
    paragraph: {
        extends: 'occurrence',
        scope: 'paragraph',
        token: String.raw`[.!?](\s|$)`,
        setting: 'max_paragraph_sentences',
        message: 'A paragraph longer than {{max}} sentences. Split it.',
    },
    sentence: {
        extends: 'occurrence',
        scope: 'sentence',
        token: String.raw`\b\w+\b`,
        setting: 'max_sentence_words',
        message: 'A sentence longer than {{max}} words. Split it.',
    },
} as const;

export const ALT_TEXT_TOKENS = [
    String.raw`<img\b(?![^>]*\balt\s*=)[^>]*>`,
    String.raw`!\[(?:Image|Graphic|Picture) of`,
] as const;

export const ACRONYMS = [
    'API',
    'CLI',
    'CSS',
    'HTML',
    'HTTP',
    'ID',
    'JSON',
    'SQL',
    'UI',
    'URL',
    // eslint-disable-next-line unicorn/text-encoding-identifier-case -- reason: ASCII spells the acronym that the prose vocabulary accepts.
    'ASCII',
    'ASD',
    'BSD',
    'CPU',
    'CRLF',
    'CSV',
    'ESM',
    'EUR',
    'GBP',
    'GNU',
    'HTTPS',
    'INI',
    'JSX',
    'MIME',
    'MIT',
    'POSIX',
    'README',
    'SCSS',
    'SDK',
    'SHA',
    'SSH',
    'SVG',
    'TLS',
    'TODO',
    'TSX',
    'USD',
    'UTC',
    'UTF',
    'WASM',
    'XML',
] as const;

export const BANNED_HEADINGS = [
    'project structure',
    'project layout',
    'repository layout',
    'repository structure',
    'directory structure',
    'folder structure',
    'file map',
    'codebase map',
    'source tree',
] as const;

export const VALE_STYLES_PATH = `${GSPOT_PATHS.configurations}/general/prose/styles`;
