export const VALE_PACKAGES = ['Google', 'write-good', 'proselint', 'alex', 'Harper'] as const;

export const VALE_PACKAGE_RELEASES = {
    Google: { version: 'v0.7.1', sha256: '4b67fca1f2a88595b2a578ab98bbf3017a23af677b04f93e862843f3ea1a9a0b' },
    'write-good': { version: 'v0.4.1', sha256: '2960ef10861ddc7dc76292a4967eb3789bf05ca24f862042f6d15f53332887f0' },
    proselint: { version: 'v0.3.4', sha256: '48b1fb481ba44f6505d44346b283f6cdc74efd234f913bbdb09bf34420fab81c' },
    alex: { version: 'v0.2.3', sha256: '44014c7f63d4a8bce86788e074edb80333a9b6eba07e5dd27b24823b69eed50b' },
    Harper: { version: 'v0.1.0', sha256: 'bfab282e7abd8906f8656c240ccd4d873679878ed8e0c42d683ad7e2798c436c' },
} as const;

const VALE_PACKAGE_REPOSITORY = 'https://github.com/vale-cli/';

export const VALE_PACKAGE_FOLDERS = [...VALE_PACKAGES, 'config/dictionaries'] as const;

export const VALE_INSTALL_ARGUMENTS = ['sync'] as const;

export const VALE_INSTALL_PREFIX = 'vale-';

export const VALE_ARCHIVE_LIMIT = 8 * 1024 * 1024;

export const VALE_SKIPPED_SCOPES = 'script, style, pre, figure, table';

export const BLOCK_IGNORES = [String.raw`(?s)^---\n.*?\n---\n`] as const;

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

export const VALE_OFF_RULES: Readonly<Record<string, string>> = {
    'proselint.Very': 'gspot.hedging owns hedges',
    'Google.EmDash': 'gspot.em-dashes owns dashes',
    'proselint.DateCase': 'Google.AMPM owns times',
    'Google.DateFormat': 'gspot.dates owns dates and accepts the month name before or after the day',
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

export const VALE_INSTALL_STEP = 'Vale sync';

export const STYLES_PATH_COMMENT =
    '# Vale reads both StylesPath lines in order and installs packages in the last folder.';

export const MIN_ALERT_LINE = 'MinAlertLevel = suggestion';

export const VOCAB_LINE = 'Vocab = words';

export const ALL_FILES_SECTION = '[*]';

export const MARKUP_RULES_COMMENT = '# Markup checks read markup only.';

export const ALT_TEXT_OFF = 'gspot.alt-text = NO';

export const NO_STYLES_LINE = 'BasedOnStyles =';

export const ALT_TEXT_ON = 'gspot.alt-text = YES';

export const VALE_DOWNLOAD_NAME = 'the Vale package';

export const VALE_PACKAGE_URLS = Object.fromEntries(
    VALE_PACKAGES.map((name) => [
        name,
        `${VALE_PACKAGE_REPOSITORY}${name}/releases/download/${VALE_PACKAGE_RELEASES[name].version}/${name}.zip`,
    ]),
) as Record<(typeof VALE_PACKAGES)[number], string>;
