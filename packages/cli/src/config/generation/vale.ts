/** The Vale input mode, source grammar, and comment format for each file extension. */

// Known source grammars parse Markdown inside comments. Module extensions without a grammar use stdin
// with the corresponding language extension. Map other comment-compatible formats through [formats].
export const PROSE_GRAMMARS = {
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
} as const;

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

/** Common technical abbreviations used in prose and shipped rules. */
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
    // eslint-disable-next-line unicorn/text-encoding-identifier-case -- reason: ASCII spells the acronym accepted by the prose vocabulary.
    'ASCII',
    'BSD',
    'CPU',
    'CRLF',
    'CSV',
    'ESM',
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
    'TSX',
    'UTC',
    'UTF',
    'WASM',
    'XML',
] as const;

export const VALE_OFF_RULES: Readonly<Record<string, string>> = {
    'Vale.Spelling': 'typos owns spelling',
    'Google.Spelling': 'typos owns spelling',
    'Harper.Spelling': 'typos owns spelling',
    'Google.Contractions': 'gspot.contractions holds the contractions rule',
    'Google.Headings': 'gspot.heading-case owns heading case',
    'Google.Acronyms': 'gspot.acronyms owns acronyms',
    'alex.ProfanityUnlikely': 'it flags execute, kill and abort, which are the words for those actions',
    'Harper.ExpandConfiguration': 'config is the common abbreviation for configuration in file and folder names',
    'Vale.Terms':
        'the vocabulary accepts spellings; it does not fix case, because configuration ids are the lowercase tool names',
    'write-good.TooWordy': 'it flags validate, multiple and it is, which are plain words',
    'write-good.Weasel': 'gspot.hedging owns hedges; this flags several and tiny',
    'Google.WordList': 'Google product terminology: command-line tool for CLI',
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
    'Google.Semicolons': 'gspot.semicolons holds the semicolon rule',
    'Google.WordListCase': 'Google product terminology: command-line tool for CLI',
    'Harper.OkToOkay': 'OK names a successful status and a button action',
} as const;

/** Skip task metadata, URLs, and documentation-tag syntax; check tag descriptions and suppression reasons as prose. */
export const TOKEN_IGNORES = [
    String.raw`(?m)(^MISE[ \t]+[a-z_][a-z0-9_-]*[ \t]*=[^\r\n]*)`,
    String.raw`(eslint-(?:disable|enable)(?:-next-line|-line)?\s+[^\n]*?--\s*(?:reason:\s*)?)`,
    String.raw`(https?://[^\s)]+)`,
    String.raw`(@(?:param|template|typedef)\s+(?:\{[^\n]*\}\s+)?(?:\[[^\]\n]*\]|\S+))`,
    String.raw`(@(?:returns?|throws|type|see|example|deprecated)\b(?:\s+\{[^\n]*\})?)`,
] as const;

/** Skip front matter. */
export const BLOCK_IGNORES = [String.raw`(?s)^---\n.*?\n---\n`] as const;

/** A script with no extension reads through stdin as Python, whose comments start the same way. */
export const SCRIPT_GRAMMAR = { mode: 'stdin', extension: '.py' } as const;

export const ALT_TEXT_TOKENS = [
    String.raw`<img\b(?![^>]*\balt\s*=)[^>]*>`,
    String.raw`!\[(?:Image|Graphic|Picture) of`,
] as const;
export const LENGTH_STYLES = {
    item: { extends: 'occurrence', scope: 'list', token: String.raw`\b\w+\b` },
    paragraph: { extends: 'occurrence', scope: 'paragraph', token: String.raw`[.!?](\s|$)` },
    sentence: { extends: 'occurrence', scope: 'sentence', token: String.raw`\b\w+\b` },
} as const;
export const RECOMMENDED_STYLES: ReadonlySet<string> = new Set(['dates', 'link-text', 'alt-text']);
export const VALE_SKIPPED_SCOPES = 'script, style, pre, figure, table';
export const VALE_MARKUP_FILES = '*.{md,mdx,html,htm,astro,svelte,vue}';

/** Punctuation escaped in human-readable Go regular-expression word lists. */
export const VALE_REGEX_SYMBOLS = /[.*+?^${}()|[\]\\/-]/gu;
