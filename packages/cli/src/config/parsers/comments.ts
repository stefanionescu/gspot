import { TOML_STRINGS } from '#cli/config/parsers/toml.ts';

/** SCSS has slash line comments and CSS block comment openers. */
export const SCSS_COMMENT_OPENERS = ['//', '/*'];

// The pieces of a TOML file: a string, a comment to the end of the line, or a run of anything else.
export const TOML_TOKENS = new RegExp(String.raw`${TOML_STRINGS.source}|#[^\n]*|[^"'#]+|["']`, 'gu');
