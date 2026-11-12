import type { ProseRoute } from '#cli/types/configurations/general.ts';

// checks

export const AMBIGUOUS_DATE = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/gu;

export const DATE_RULE = 'ambiguous-date';

export const NO_OUTPUT = 'no output';

export const PROSE_GRAMMARS: Readonly<Record<string, Omit<ProseRoute, 'path'> & { format?: string }>> = {
    '.md': { mode: 'path', extension: '.md' },
    '.mdx': { mode: 'path', extension: '.md' },
    '.ts': { mode: 'path', extension: '.ts', format: 'md' },
    '.tsx': { mode: 'path', extension: '.ts', format: 'md' },
    '.mts': { mode: 'stdin', extension: '.ts' },
    '.cts': { mode: 'stdin', extension: '.ts' },
    '.js': { mode: 'path', extension: '.js', format: 'md' },
    '.mjs': { mode: 'stdin', extension: '.js' },
    '.cjs': { mode: 'stdin', extension: '.js' },
    '.jsx': { mode: 'path', extension: '.js', format: 'md' },
    '.swift': { mode: 'path', extension: '.swift', format: 'md' },
    '.py': { mode: 'path', extension: '.py', format: 'md' },
    '.css': { mode: 'path', extension: '.css', format: 'md' },
    '.sh': { mode: 'path', extension: '.sh', format: 'py' },
    '.bash': { mode: 'path', extension: '.bash', format: 'py' },
    '.zsh': { mode: 'path', extension: '.zsh', format: 'py' },
    '.sql': { mode: 'path', extension: '.sql', format: 'lua' },
    '.pgsql': { mode: 'path', extension: '.pgsql', format: 'lua' },
    '.psql': { mode: 'path', extension: '.psql', format: 'lua' },
};

export const SCRIPT_GRAMMAR = { mode: 'stdin', extension: '.py' } as const;

export const VALE_ARGUMENTS = ['--no-global', '--output', 'JSON', '--no-exit'] as const;

export const VALE_ERROR_LINE = /(?:^E\d+)|(?:not found)|(?:error)/iu;

export const VALE_MESSAGE_RULES = [
    'gspot.modals',
    'gspot.hedging',
    'gspot.marketing',
    'gspot.future',
    'gspot.contractions',
    'gspot.since',
    'gspot.symbols',
    'gspot.em-dashes',
    'gspot.terms',
] as const;

// generated config

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

export const ACRONYM_DEFINITION_PATTERN = String.raw`(?:\b[A-Za-z]+(?:-[A-Za-z]+)* ){2,5}\(([A-Z]{3,6})\)`;

export const ACRONYM_MESSAGE = "Spell out '%s' on first use.";

export const ACRONYM_NAME = /^[A-Z]{3,6}$/u;

export const ACRONYM_PATTERN = String.raw`\b([A-Z]{3,6})\b`;

export const ALL_FILES_SECTION = '[*]';

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

export const BLOCK_IGNORES = [String.raw`(?s)^---\n.*?\n---\n`] as const;

// A word such as 3D starts with a digit, so Vale cannot read it as a capitalized first word.
export const DIGIT_WORD_PATTERN = String.raw`\b\d+[A-Z][A-Z\d]*\b`;

export const FILE_NAME_PATTERN = String.raw`[\w-]+(?:\.[\w-]+)*\.[A-Za-z]\w*`;

export const HEADING_CASE_STYLE = {
    message: "Write titles and headings in sentence case: '%s'.",
    scope: ['heading', 'text.frontmatter.title'],
    match: '$sentence',
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

export const MARKUP_RULES_COMMENT = '# Markup checks read markup only.';

export const MIN_ALERT_LINE = 'MinAlertLevel = suggestion';

export const NO_STYLES_LINE = 'BasedOnStyles =';

export const STYLES_PATH_COMMENT =
    '# Vale reads both StylesPath lines in order and installs packages in the last folder.';

export const TERMS_MESSAGE = "Use '%s' instead of '%s'.";

export const TOKEN_IGNORES = [
    String.raw`(?m)(^USAGE[ \t]+[^\r\n]*)`,
    String.raw`(?m)(^MISE[ \t]+[a-z_][a-z0-9_-]*[ \t]*=[^\r\n]*)`,
    String.raw`(?m)(^[ \t]*(?://|/\*)?[ \t]*(?:eslint|stylelint)-(?:disable|enable)(?:-next-line|-line)?\s+[^\n]*?--\s*(?:reason:\s*)?)`,
    String.raw`(https?://[^\s)]+)`,
    String.raw`(@(?:param|template|typedef|property|prop|arg|argument|callback)\s+(?:\{[^\n]*\}\s+)?(?:\[[^\]\n]*\]|\S+))`,
    String.raw`(@(?:returns?|throws|type|see|example|deprecated|yields|enum|this|satisfies)\b(?:\s+\{[^\n]*\})?)`,
    String.raw`(?m)((?:^|[ \t])[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b)`,
    String.raw`(?m)((?:^|[ \t])[A-Z][A-Z0-9_-]*\.(?:md|txt|json|toml|ya?ml)\b)`,
] as const;

export const VALE_COMMENT_RULES = [
    'gspot.conscious-language',
    'gspot.placeholders',
    'gspot.session-identifiers',
    'gspot.straight-quotes',
    'gspot.em-dashes',
    'gspot.modals',
    'gspot.hedging',
    'gspot.marketing',
    'gspot.future',
    'gspot.history',
    'gspot.contractions',
    'gspot.since',
    'gspot.locations',
    'gspot.self-reference',
    'gspot.symbols',
    'gspot.idioms',
    'gspot.home-paths',
    'gspot.terms',
] as const;

export const VALE_MARKUP_FILES = '*.{md,mdx}';

export const VALE_MARKUP_RULES = ['gspot.alt-prefix', 'gspot.tree-blocks'] as const;

export const VALE_OFF_RULES: Readonly<Record<string, string>> = {
    'proselint.Very': 'gspot.hedging owns hedges',
    'Google.EmDash': 'gspot.em-dashes owns dashes',
    'proselint.DateCase': 'Google.AMPM owns times',
    'Google.DateFormat': 'prose/dates owns dates and accepts the month name before or after the day',
    'write-good.E-Prime': 'it flags every form of to be, which plain sentences need',
    'Vale.Spelling': 'typos owns spelling',
    'Google.Spelling': 'typos owns spelling',
    'Harper.Spelling': 'typos owns spelling',
    'Google.Contractions': 'gspot.contractions owns contractions',
    'Google.Headings': 'gspot.heading-case owns heading case',
    'Google.Acronyms': 'gspot.acronyms owns acronyms',
    'alex.ProfanityUnlikely': 'it flags execute, kill and abort, which are the words for those actions',
    'Harper.ExpandConfiguration': 'config is the common abbreviation for configuration in file and folder names',
    'Vale.Terms':
        'the vocabulary accepts spellings; it does not fix case, because configuration ids are lowercase tool names, which it flags',
    'write-good.TooWordy': 'it flags validate, multiple and it is, which are plain words',
    'write-good.Weasel': 'gspot.hedging owns hedges; this flags several and tiny',
    'Google.WordList': 'it asks for command-line tool in place of CLI',
    'Google.Colons': 'it lowercases acronyms after a colon',
    'Google.ExcessiveClaims': 'guarantee is a technical word for what a check makes certain',
    'Google.Will': 'gspot.future owns the future tense',
    'Google.Timeless': 'gspot.history owns time words',
    'Google.Jargon': 'camel case is the name of the case',
    'alex.Ablist': 'it flags disabled, as in a disabled rule',
    'alex.ProfanityMaybe': 'swallow, trap and abuse are what code does to errors, signals and inputs',
    'alex.ProfanityLikely': 'looser is a comparative',
    'alex.Race': 'primitive is a type',
    'alex.Suicide': 'a process hangs',
    'proselint.Typography': 'three dots stay ASCII',
    'proselint.Needless': 'oversized and extensible are the words',
    'Harper.ExpandMemoryShorthands': 'MB and GB are the units',
    'Harper.MoreAdjective2': 'it reports that an inflected form exists, which is not an error',
    'Harper.MoreAdjective4': 'it reports that an inflected form exists, which is not an error',
    'Google.Semicolons': 'it reports every semicolon',
    'Google.WordListCase': 'it asks for command-line tool in place of CLI',
    'Harper.OkToOkay': 'OK names a successful status and a button action',
    'write-good.Passive': 'Google.Passive owns passive voice',
    'Harper.NumericRangeEnDash': 'gspot.en-dashes owns ranges',
};

export const VALE_REGEX_SYMBOLS = /[.*+?^${}()|[\]\\/-]/gu;

export const VALE_SKIPPED_SCOPES = 'script, style, pre, figure, table';

export const VOCAB_LINE = 'Vocab = words';
