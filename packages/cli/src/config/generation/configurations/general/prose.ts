import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

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
    String.raw`<img(?:\s+(?!alt(?:\s*=|[\s/>]))[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*\s*/?>`,
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

export const BANNED_HEADING_MESSAGE = "Heading '%s' lists files and folders. Describe behavior and ownership instead.";

export const ACRONYM_MESSAGE = "Spell out '%s' on first use.";

export const ACRONYM_PATTERN = String.raw`\b([A-Z]{3,6})\b`;

export const ACRONYM_DEFINITION_PATTERN = String.raw`(?:\b[A-Za-z]+(?:-[A-Za-z]+)* ){2,5}\(([A-Z]{3,6})\)`;

export const ALT_TEXT_MESSAGE = 'An image needs an alt attribute; decorative images can use an empty value.';

export const ACRONYM_NAME = /^[A-Z]{3,6}$/u;
