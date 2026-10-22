/**
 * toml-patch starts a parse error with its location, the source line, and a caret; gspot drops these lines and names
 * the location itself.
 */
export const PARSE_CONTEXT_LINES = 3;

/** The commands that change gspot.toml. */
export const SETTINGS_COMMANDS = ['set', 'unset', 'add', 'remove', 'ignore', 'unignore'] as const;
