export const PARAMETER_DEPTH = new Map<string, number>([
    ['(', 1],
    ['[', 1],
    [')', -1],
    [']', -1],
]);

export const CREATE_PREFIX = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?/iu;

export const CREATE_MODIFIER = /^(?:UNIQUE|CONSTRAINT|MATERIALIZED|TEMPORARY|TEMP|UNLOGGED)\s+/iu;

export const CREATE_KIND = /^\w+(?:\s+IF\s+NOT\s+EXISTS)?/iu;

export const NAME_TOKEN = /"(?:[^"]|"")*"|[\p{L}_][\p{L}\p{N}_$]*/gu;

export const QUALIFIED_NAME = new RegExp(
    String.raw`^(?:${NAME_TOKEN.source})(?:\s*\.\s*(?:${NAME_TOKEN.source}))*`,
    'u',
);

export const TABLE_PARAMETERS = /^\s*RETURNS\s+TABLE\s*\(/iu;

export const PARAMETER_PREFIX = /^\s*(?:(?:INOUT|IN|OUT|VARIADIC)\s+)?/iu;
