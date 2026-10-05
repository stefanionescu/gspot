/** A script with no extension reads through stdin as Python, whose comments start the same way. */
export const SCRIPT_GRAMMAR = { mode: 'stdin', extension: '.py' } as const;

/** The name Vale gives stdin, followed by the grammar extension. */
export const VALE_STDIN = 'stdin';

/** An authored Markdown comment that changes the Vale rules for its source. */
export const VALE_DIRECTIVE = new RegExp(String.raw`<!--\s*vale\b`, 'u');

export const CODE_SPAN = /`[^`]*`/gu;
