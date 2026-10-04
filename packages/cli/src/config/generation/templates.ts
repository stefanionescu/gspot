export const JSON_INDENT = 4;

export const ETA_OPTIONS = {
    autoEscape: false,
    autoTrim: false,
    useWith: true,
    rmWhitespace: false,
    varName: 'it',
} as const;

export const LEADING_NEWLINES = /^\n+/u;

/** URLs and documentation-tag syntax are code. Tag descriptions and suppression reasons remain prose. */
export const TOKEN_IGNORES = [
    String.raw`(eslint-(?:disable|enable)(?:-next-line|-line)?\s+[^\n]*?--\s*reason:\s*)`,
    String.raw`(https?://[^\s)]+)`,
    String.raw`(@(?:param|template|typedef)\s+(?:\{[^}\n]*\}\s+)?(?:\[[^\]\n]*\]|\S+))`,
    String.raw`(@(?:returns?|throws|type|see|example|deprecated)\b(?:\s+\{[^}\n]*\})?)`,
];

/** Front matter is not prose. */
export const BLOCK_IGNORES = [String.raw`(?s)^---\n.*?\n---\n`];
