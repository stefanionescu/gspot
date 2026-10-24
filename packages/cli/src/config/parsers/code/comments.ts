export const YAML_SCALAR_TOKENS: ReadonlySet<string> = new Set(['doc-mode', 'flow-error-end', 'scalar']);

export const HTML_ALTERNATE_COMMENT_END = '--!>';

export const COMMENT_NODES = ['comment', 'multiline_comment'] as const;

export const BLOCK_COMMENT_END = /\*\/\s*$/u;

export const HTML_COMMENT_END = /--!?>\s*$/u;

export const ASTRO_FRONT_MATTER = /^\u{FEFF}?---[\t ]*\r?\n((?:[^\n]*\n)*?)---[\t ]*(?:\r?\n|$)/u;
