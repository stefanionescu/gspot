import { VALE_PACKAGES } from '#cli/config/generation/configurations/general/prose.ts';

export const VALE_PACKAGE_FOLDERS = [...VALE_PACKAGES, 'config/dictionaries'] as const;

export const VALE_INSTALL_ARGUMENTS = ['sync'] as const;

export const VALE_INSTALL_PREFIX = 'vale-';

export const VALE_ARCHIVE_LIMIT = 8 * 1024 * 1024;

export const VALE_SKIPPED_SCOPES = 'script, style, pre, figure, table';

export const BLOCK_IGNORES = [String.raw`(?s)^---\n.*?\n---\n`] as const;

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
    'proselint.Very': 'gspot.hedging owns hedges',
    'Google.EmDash': 'gspot.em-dashes owns dashes',
    'proselint.DateCase': 'Google.AMPM owns times',
    'write-good.E-Prime': 'it flags every form of to be, which plain sentences need',
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
    'Google.Semicolons': 'it reports every semicolon',
    'Google.WordListCase': 'Google product terminology: command-line tool for CLI',
    'Harper.OkToOkay': 'OK names a successful status and a button action',
    'write-good.Passive': 'Google.Passive owns passive voice',
    'Harper.NumericRangeEnDash': 'gspot.en-dashes owns ranges',
};

export const VALE_MARKUP_RULES = ['gspot.merge-conflict-markers', 'gspot.tree-blocks'] as const;

export const VALE_COMMENT_RULES = [
    'gspot.conscious-language',
    'gspot.placeholders',
    'gspot.merge-conflict-markers',
    'gspot.session-identifiers',
    'gspot.straight-quotes',
    'gspot.em-dashes',
] as const;

export const VALE_MARKUP_FILES = '*.{md,mdx}';
