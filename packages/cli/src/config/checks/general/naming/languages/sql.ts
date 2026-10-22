export const SQL_PARAMETER_DEPTH = new Map<string, number>([
    ['(', 1],
    ['[', 1],
    [')', -1],
    [']', -1],
]);

export const SQL_CREATE_PREFIX = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?/iu;

export const SQL_CREATE_MODIFIER = /^(?:UNIQUE|CONSTRAINT|MATERIALIZED|TEMPORARY|TEMP|UNLOGGED)\s+/iu;

export const SQL_CREATE_KIND = /^\w+(?:\s+IF\s+NOT\s+EXISTS)?/iu;

/** Complete PostgreSQL name tokens, including doubled quotes inside quoted names. */
export const SQL_NAME_TOKEN = /"(?:[^"]|"")*"|[\p{L}_][\p{L}\p{N}_$]*/gu;

/** The full qualified name of a relation starts at its RangeVar location. */
export const SQL_QUALIFIED_NAME = new RegExp(
    String.raw`^(?:${SQL_NAME_TOKEN.source})(?:\s*\.\s*(?:${SQL_NAME_TOKEN.source}))*`,
    'u',
);

/** Return-table declarations add output parameters after the input list. */
export const SQL_TABLE_PARAMETERS = /^\s*RETURNS\s+TABLE\s*\(/iu;

/** Function parameters begin after an optional PostgreSQL parameter mode. */
export const SQL_PARAMETER_PREFIX = /^\s*(?:(?:INOUT|IN|OUT|VARIADIC)\s+)?/iu;
