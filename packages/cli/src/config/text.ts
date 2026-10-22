export const SIMILAR_NAME_LIMIT = 3;

export const TYPO_MIN = 2;

export const TYPO_FRACTION = 3;

/** How many names a message lists before it counts the rest. */
export const LIST_LIMIT = 8;

export const LINE_FEED = 10;

export const DIGEST_ALGORITHM = 'sha256';

export const PLAIN_ARGUMENT = /^[\w@:./-]+$/u;

export const NOT_LINE_BREAK = /[^\r\n]/gu;

export const DIGITS_ONLY = /^\d+$/u;

/** The replacement text that puts a backslash before each match of a pattern. */
export const BACKSLASH_BEFORE_MATCH = String.raw`\$&`;
