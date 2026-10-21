import { PROSE_GRAMMARS } from '#cli/config/checks/prose.ts';

/** The upstream styles shipped at level all. */
export const VALE_PACKAGES = ['Google', 'write-good', 'proselint', 'alex', 'Harper'] as const;

/** The release of each upstream style that gspot installs, so every clone checks prose with the same rules. */
export const VALE_PACKAGE_RELEASES = {
    Google: 'v0.7.1',
    'write-good': 'v0.4.1',
    proselint: 'v0.3.4',
    alex: 'v0.2.3',
    Harper: 'v0.1.0',
} as const;

/** The upstream styles: this prefix, then `<name>/releases/download/<release>/<name>.zip`. */
export const VALE_PACKAGE_REPOSITORY = 'https://github.com/vale-cli/';

/** Comment extensions and their Vale format. */
export const PROSE_FORMATS = Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
    'format' in grammar ? [[extension.slice(1), grammar.format] as const] : [],
);

/** Punctuation escaped in human-readable Go regular-expression word lists. */
export const VALE_REGEX_SYMBOLS = /[.*+?^${}()|[\]\\/-]/gu;

export const VALE_MARKUP_FILES = '*.{md,mdx}';

export const VALE_MARKUP_RULES = ['gspot.merge-conflict-markers', 'gspot.tree-blocks'] as const;

export const VALE_SKIPPED_SCOPES = 'script, style, pre, figure, table';

export const LENGTH_STYLES = {
    item: { extends: 'occurrence', scope: 'list', token: String.raw`\b\w+\b` },
    paragraph: { extends: 'occurrence', scope: 'paragraph', token: String.raw`[.!?](\s|$)` },
    sentence: { extends: 'occurrence', scope: 'sentence', token: String.raw`\b\w+\b` },
} as const;

export const ALT_TEXT_TOKENS = [
    String.raw`<img\b(?![^>]*\balt\s*=)[^>]*>`,
    String.raw`!\[(?:Image|Graphic|Picture) of`,
] as const;

/** Skip front matter. */
export const BLOCK_IGNORES = [String.raw`(?s)^---\n.*?\n---\n`] as const;

/**
 * Skip task metadata, URLs, documentation-tag syntax, snake_case identifiers, and upper-case file names; check tag
 * descriptions and suppression reasons as prose. A name starts a line or follows a space or tab. Vale wraps each match in
 * backticks: a match inside a code span breaks the span, and a match that holds a line break breaks a code fence.
 */
export const TOKEN_IGNORES = [
    String.raw`(?m)(^MISE[ \t]+[a-z_][a-z0-9_-]*[ \t]*=[^\r\n]*)`,
    String.raw`(eslint-(?:disable|enable)(?:-next-line|-line)?\s+[^\n]*?--\s*(?:reason:\s*)?)`,
    String.raw`(https?://[^\s)]+)`,
    String.raw`(@(?:param|template|typedef|property|prop|arg|argument|callback)\s+(?:\{[^\n]*\}\s+)?(?:\[[^\]\n]*\]|\S+))`,
    String.raw`(@(?:returns?|throws|type|see|example|deprecated|yields|enum|this|satisfies)\b(?:\s+\{[^\n]*\})?)`,
    String.raw`(?m)((?:^|[ \t])[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b)`,
    String.raw`(?m)((?:^|[ \t])[A-Z][A-Z0-9_-]*\.(?:md|txt|json|toml|ya?ml)\b)`,
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
    'write-good.Passive': 'Google.Passive owns passive voice',
    'Harper.NumericRangeEnDash': 'gspot.en-dashes owns ranges',
} as const;

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
