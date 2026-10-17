export const FROZEN_NONE = 'none';

export const FROZEN_ALL = 'all';

/** Numeric migration versions can start with the Flyway V prefix. */
export const MIGRATION_VERSION = /^V?(?<version>\d+)/u;

export const IDENTIFIER_START = /[A-Za-z_]/u;

export const WORD_CHARACTER = /\w/u;

export const DOLLAR_TAG_BLOCKER = /[\p{L}\p{N}_$]/u;

export const MIGRATION_NUMBER = /^\d+$/u;

/** Complete PostgreSQL name tokens, including doubled quotes inside quoted names. */
export const SQL_NAME_TOKEN = /"(?:[^"]|"")*"|[\p{L}_][\p{L}\p{N}_$]*/gu;

/** The full qualified name of a relation starts at its RangeVar location. */
export const SQL_QUALIFIED_NAME = new RegExp(
    String.raw`^(?:${SQL_NAME_TOKEN.source})(?:\s*\.\s*(?:${SQL_NAME_TOKEN.source}))*`,
    'u',
);

export const SQL_DECLARATION_PREFIX =
    // eslint-disable-next-line sonarjs/regex-complexity -- reason: This PostgreSQL keyword list keeps declaration positions exact without accepting unrelated creation forms.
    /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:UNIQUE|CONSTRAINT|MATERIALIZED|TEMPORARY|TEMP|UNLOGGED)\s+)?\w+(?:\s+IF\s+NOT\s+EXISTS)?/iu;

/** Function parameters begin after an optional PostgreSQL parameter mode. */
export const SQL_PARAMETER_PREFIX = /^\s*(?:(?:INOUT|IN|OUT|VARIADIC)\s+)?/iu;

/** Return-table declarations add output parameters after the input list. */
export const SQL_TABLE_PARAMETERS = /^\s*RETURNS\s+TABLE\s*\(/iu;

export const SQL_PARAMETER_DEPTH = new Map<string, number>([
    ['(', 1],
    ['[', 1],
    [')', -1],
    [']', -1],
]);
