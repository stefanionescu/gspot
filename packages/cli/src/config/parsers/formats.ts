export const MESSAGE_END = /[.:]$/u;

export const JSONC_OPTIONS = { allowTrailingComma: true } as const;

export const LEADING_NEWLINE = /^\r?\n/u;

export const MARKERS = {
    markdown: { start: '<!-- >>> gspot managed >>> -->', end: '<!-- <<< gspot managed <<< -->', gap: '\n\n' },
    hash: { start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<', gap: '\n' },
} as const;

export const BLOCK_STYLES = { 'AGENTS.md': 'markdown', '.gitattributes': 'hash' } as const;

export const FIRST_BLOCK_FILE = '.gitattributes';

export const PATCH_FORMAT = { inlineTableStart: 2, bracketSpacing: false, trailingComma: false } as const;

export const MISSING_RANGE_MESSAGE = 'The TOML parser omitted a source range.';

export const TABLE_PROPERTY_FLAGS = { enumerable: true, writable: true, configurable: true } as const;
