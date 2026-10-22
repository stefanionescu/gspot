/** The settings file of a repository. */
export const SETTINGS_FILE = 'gspot.toml';

/**
 * toml-patch starts a parse error with its location, the source line, and a caret; gspot drops these lines and names
 * the location itself.
 */
export const PARSE_CONTEXT_LINES = 3;
