// The PostgreSQL parser accepts only the postgres dialect; SQLFluff checks other dialects.
export const PARSED_DIALECTS = new Set(['postgres']);

export const BLOCK_COMMENT = '/*';

export const LINE_COMMENT = '--';

// A string, a quoted name, a line comment, or the start of a block comment, whichever comes first.
export const SQL_TOKENS = /'[^']*'|"[^"]*"|--[^\n]*|\/\*/gu;

export const OUTPUT_PARAMETERS = new Set(['FUNC_PARAM_OUT', 'FUNC_PARAM_TABLE']);
