/** The two things a source file must not say to Vale: a directive in Markdown, a block comment in SQL. */
export const VALE_DIRECTIVE = /<!--\s*vale\b/u;
export const CODE_SPAN = /`[^`]*`/gu;
export const SQL_BLOCK_COMMENT = '/*';
