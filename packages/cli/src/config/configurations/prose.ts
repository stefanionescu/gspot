import { LOCKFILES } from '#cli/config/repository/javascript.ts';

export const VALE_ARGUMENTS = ['--no-global', '--output', 'JSON', '--no-exit'] as const;

export const SCRIPT_GRAMMAR = { mode: 'stdin', extension: '.py' } as const;

export const VALE_ERROR_LINE = /(?:^E\d+)|(?:not found)|(?:error)/iu;

export const NO_OUTPUT = 'no output';

export const VALE_REGEX_SYMBOLS = /[.*+?^${}()|[\]\\/-]/gu;

export const HEADING_CASE_STYLE = {
    message: "Write titles and headings in sentence case: '%s'.",
    scope: ['heading', 'text.frontmatter.title'],
    match: '$sentence',
} as const;

export const FILE_NAME_PATTERN = String.raw`[\w-]+(?:\.[\w-]+)*\.[A-Za-z]\w*`;

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

export const AMBIGUOUS_DATE = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/gu;

export const DATE_RULE = 'ambiguous-date';

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

export const BANNED_HEADING_MESSAGE = "Heading '%s' lists files and folders. Describe behavior and ownership instead.";

export const ACRONYM_MESSAGE = "Spell out '%s' on first use.";

export const ACRONYM_PATTERN = String.raw`\b([A-Z]{3,6})\b`;

export const ACRONYM_DEFINITION_PATTERN = String.raw`(?:\b[A-Za-z]+(?:-[A-Za-z]+)* ){2,5}\(([A-Z]{3,6})\)`;

export const ACRONYM_NAME = /^[A-Z]{3,6}$/u;

export const TYPOS_LOCKFILE_GLOBS = [
    '*.lock',
    ...LOCKFILES.map(({ file }) => file).filter((file) => !file.endsWith('.lock')),
];

export const TYPOS_FORMAT_GLOBS = ['*.pbxproj', '*.xcstrings', '*.svg', '*.min.js', '*.min.css'] as const;

export const TYPOS_IGNORE_PATTERNS = [
    String.raw`\b[0-9a-f]{7,40}\b`,
    String.raw`\b[A-Za-z0-9+/]{40,}={0,2}\b`,
] as const;

export const TYPOS_CHECK = 'spelling/typos';

export const LOCKFILE_GLOB = '*.lock';

export const LOCKFILE_EXTENSION = '.lock';

export const EXTEND_EXCLUDE_LINE = 'extend-exclude = [';
