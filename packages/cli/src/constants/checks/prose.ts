// The literal values checks/prose reads: names, patterns, limits, and tables.

/** The two things a source file must not say to Vale: a directive in Markdown, a block comment in SQL. */
export const VALE_DIRECTIVE = /<!--\s*vale\b/u;
export const CODE_SPAN = /`[^`]*`/gu;
export const SQL_BLOCK_COMMENT = '/*';
export const MARKDOWN = new Set(['.md', '.mdx']);
export const SQL = new Set(['.sql', '.pgsql', '.psql']);
