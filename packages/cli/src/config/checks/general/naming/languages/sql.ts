export const SQL_PARAMETER_DEPTH = new Map<string, number>([
    ['(', 1],
    ['[', 1],
    [')', -1],
    [']', -1],
]);

export const SQL_CREATE_PREFIX = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?/iu;

export const SQL_CREATE_MODIFIER = /^(?:UNIQUE|CONSTRAINT|MATERIALIZED|TEMPORARY|TEMP|UNLOGGED)\s+/iu;

export const SQL_CREATE_KIND = /^\w+(?:\s+IF\s+NOT\s+EXISTS)?/iu;

export const SQL_NAME_TOKEN = /"(?:[^"]|"")*"|[\p{L}_][\p{L}\p{N}_$]*/gu;

export const SQL_QUALIFIED_NAME = new RegExp(
    String.raw`^(?:${SQL_NAME_TOKEN.source})(?:\s*\.\s*(?:${SQL_NAME_TOKEN.source}))*`,
    'u',
);

export const SQL_TABLE_PARAMETERS = /^\s*RETURNS\s+TABLE\s*\(/iu;

export const SQL_PARAMETER_PREFIX = /^\s*(?:(?:INOUT|IN|OUT|VARIADIC)\s+)?/iu;
