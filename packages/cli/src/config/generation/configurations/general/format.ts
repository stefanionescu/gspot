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
