import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';

export const COMMITLINT_ERROR_SEVERITY = 2;

const COMMIT_LINE_LENGTH = 72;

export const COMMITLINT_RULES = {
    'type-case': [COMMITLINT_ERROR_SEVERITY, 'always', 'lower-case'],
    'type-empty': [COMMITLINT_ERROR_SEVERITY, 'never'],
    'scope-case': [COMMITLINT_ERROR_SEVERITY, 'always', 'kebab-case'],
    'subject-empty': [COMMITLINT_ERROR_SEVERITY, 'never'],
    'subject-full-stop': [COMMITLINT_ERROR_SEVERITY, 'never', '.'],
    'subject-case': [COMMITLINT_ERROR_SEVERITY, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [COMMITLINT_ERROR_SEVERITY, 'always', COMMIT_LINE_LENGTH],
    'body-leading-blank': [COMMITLINT_ERROR_SEVERITY, 'always'],
    'body-max-line-length': [COMMITLINT_ERROR_SEVERITY, 'always', COMMIT_LINE_LENGTH],
    'footer-leading-blank': [COMMITLINT_ERROR_SEVERITY, 'always'],
} as const;

export const COMMITLINT_PARSER_PRESET = {
    parserOpts: {
        headerPattern: String.raw`^(\w*)(?:\((.*)\))?!?: (.*)$`,
        breakingHeaderPattern: String.raw`^(\w*)(?:\((.*)\))?!: (.*)$`,
        headerCorrespondence: ['type', 'scope', 'subject'],
    },
} as const;

export const TAPLO_FORMATTING = {
    array_auto_expand: false,
    array_auto_collapse: false,
} as const;

export const MISE_SCHEMA = {
    name: 'mise',
    description: 'The mise settings file',
    fileMatch: [
        'mise.toml',
        '.mise.toml',
        '.mise/conf.d/*.toml',
        '.config/mise/config.toml',
        '.config/mise/conf.d/*.toml',
        GSPOT_PATHS.miseProject,
    ],
    location: 'https://mise.jdx.dev/schema/mise.json',
} as const;

export const V8R_NOTES = ['# The other selected tools check files without a known schema.'];

export const YAMLLINT_RULE_OPTIONS = { truthy: { 'check-keys': false } } as const;

export const YAMLLINT_YAML_OPTIONS = { version: '1.1' } as const;

export const YAMLLINT_RULES = ['anchors', 'key-duplicates', 'octal-values', 'truthy'] as const;

export const V8R_TABLE = 'tools.v8r';

export const YAMLLINT_CHECK = 'data-files/yamllint';

export const OSV_SCANNER_NOTES = [
    '# This file stops OSV-Scanner from reading an osv-scanner.toml next to a lockfile.',
    '# Accept a vulnerability with gspot ignore dependencies/osv-scanner --rule <ID> and a reason.',
];

export const BUNFIG_FILE = 'bunfig.toml';

export const SCANNER_KEY = ['install', 'security', 'scanner'] as const;

export const OSV_SCANNER_CHECK = 'dependencies/osv-scanner';

export const LYCHEE_REPOSITORY_LINKS = 'file://$1/';

export const LYCHEE_ROOT_LINKS = String.raw`^file://(.*)/\.gspot/root-links/`;

export const LYCHEE_MDX_EXPRESSION = '%7B[^/]*%7D';

export const LYCHEE_NOTES = [
    '# This file stops lychee from reading a lychee.toml in the folder where it runs.',
    '# Allow a URL with the docs.allowed_urls setting.',
];

export const LYCHEE_ROOT_NOTE = '# A link that starts with / starts at the repository root, as on GitHub.';

export const LYCHEE_SITE_NOTE = '# A link that starts with / names a route of the site, so lychee skips it.';

export const JSCPD_IMPORT_PATTERNS = [
    String.raw`import\s[^;]*?from\s*['"][^'"]+['"]\s*;`,
    String.raw`(?:^|\n)[\t ]*(?:from[\t ]+(?:\\\r?\n[\t ]*)*[\w.]+[\t ]+(?:\\\r?\n[\t ]*)*)?import[\t ]+(?:\\\r?\n[\t ]*)*(?:\([^;)]*\)|(?:\\\r?\n|[^;\r\n])*)`,
] as const;

export const JSCPD_IGNORED = ['**/*.md', '**/*.mdx'] as const;

export const JSCPD_CHECK = 'duplication/jscpd';

export const EDITORCONFIG_FIXED_SECTIONS = {
    // eslint-disable-next-line unicorn/text-encoding-identifier-case -- reason: EditorConfig defines this charset value as utf-8.
    '*': { charset: 'utf-8', trim_trailing_whitespace: true },
    '*.md': { trim_trailing_whitespace: false },
    Makefile: { indent_style: 'tab' },
} as const;

export const UNREPRESENTABLE_SELECTOR = /[\r\n]|[!+?*@]\(/u;

export const PRETTIER_FIXED_OPTIONS = { embeddedLanguageFormatting: 'off' } as const;

export const DEFAULT_QUOTES = { prettier: 'single', ruff: 'double' } as const;

export const EDITORCONFIG_ROOT_LINE = 'root = true\n\n';

export const PRETTIER_CHECK = 'format/prettier';

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
