/** SCSS has slash line comments and CSS block comment openers. */
export const SCSS_COMMENT_OPENERS = ['//', '/*'] as const;

export const QUOTE_CHARACTERS = ["'", '"', '`'] as const;

export const YAML_SCALAR_TOKENS = ['doc-mode', 'flow-error-end', 'scalar'] as const;

export const HTML_ALTERNATE_COMMENT_END = '--!>';

export const COMMENT_NODES = ['comment', 'multiline_comment'] as const;

export const BLOCK_COMMENT_END = /\*\/\s*$/u;

export const HTML_COMMENT_END = /--!?>\s*$/u;

export const TREE_COMMENT_LANGUAGES = ['bash', 'python', 'swift', 'html', 'css'] as const;
