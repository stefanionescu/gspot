export const EDITORCONFIG_FIXED_SECTIONS = {
    // eslint-disable-next-line unicorn/text-encoding-identifier-case -- reason: EditorConfig defines this charset value as utf-8.
    '*': { charset: 'utf-8', trim_trailing_whitespace: true },
    '*.md': { trim_trailing_whitespace: false },
    Makefile: { indent_style: 'tab' },
} as const;

// Line breaks and extglob groups, which EditorConfig sections cannot express.
export const UNREPRESENTABLE_SELECTOR = /[\r\n]|[!+?*@]\(/u;
