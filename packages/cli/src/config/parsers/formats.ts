// json

export const JSONC_OPTIONS = { allowTrailingComma: true } as const;

// managed blocks
export const BLOCK_STYLES = { 'AGENTS.md': 'markdown', '.gitattributes': 'hash' } as const;
export const FIRST_BLOCK_FILE = '.gitattributes';
export const LEADING_NEWLINE = /^\r?\n/u;
export const MARKERS = {
    markdown: { start: '<!-- >>> gspot managed >>> -->', end: '<!-- <<< gspot managed <<< -->', gap: '\n\n' },
    hash: { start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<', gap: '\n' },
} as const;

// nginx
export const ESCAPED_CHARACTER = /\\([trn"'\\])/gu;
export const ESCAPE_LENGTH = 2;
export const NGINX_ESCAPES: Readonly<Record<string, string>> = {
    t: '\t',
    r: '\r',
    n: '\n',
    '"': '"',
    "'": "'",
    '\\': '\\',
};
export const NGINX_PUNCTUATION = new Set([';', '{', '}']);
export const QUOTED_ARGUMENT = /^(["'])([\s\S]*)\1$/u;
export const WHITESPACE_CHARACTER = /\s/u;
export const WORD_START_STOPS = /[\s"'{};#\\]/u;
export const WORD_STOPS = /[\s{};\\]/u;

// toml
export const MESSAGE_END = /[.:]$/u;
export const MISSING_RANGE_MESSAGE = 'The TOML parser omitted a source range.';
export const PATCH_FORMAT = { inlineTableStart: 2, bracketSpacing: false, trailingComma: false } as const;
export const TABLE_PROPERTY_FLAGS = { enumerable: true, writable: true, configurable: true } as const;

// yaml
export const YAML_OPTIONS = { merge: true, logLevel: 'error' } as const;
export const YAML_POSITION_OPTIONS = { keepSourceTokens: true, prettyErrors: false } as const;
