import type { Node } from '@pgsql/types';

/** Source span and kind of one PostgreSQL literal or psql client token. */
export type SqlToken = {
    start: number;
    end: number;
    kind: 'block-comment' | 'line-comment' | 'dollar' | 'command' | 'variable' | 'other';
};

/** Original UTF-16 boundaries of one client substitution. */
export type SqlRange = { start: number; end: number };

/** The SQL text that the parser reads, with psql commands blanked out, and where each psql variable sat. */
export type PreparedSql = { text: string; variables: SqlRange[] };

/** The fields of each PostgreSQL parse tree node, by node kind. */
export type SqlNodeFields = { [Entry in Node as keyof Entry]: Entry[keyof Entry] };

/** One parsed statement: its kind, its fields, and where it starts. */
export type SqlStatement<Kind extends keyof SqlNodeFields = keyof SqlNodeFields> = {
    [Name in Kind]: { kind: Name; fields: SqlNodeFields[Name]; start: number };
}[Kind];

/** A reader for each statement kind, which gets the fields of that kind and the arguments that the caller passes. */
export type SqlStatementVisitors<Result, Arguments extends unknown[] = []> = {
    [Kind in keyof SqlNodeFields]?: (statement: SqlStatement<Kind>, ...readerArguments: Arguments) => Result;
};

/** A parsed file: the statements, or the error with its line and column. */
export type SqlFile = {
    source: string;
    variables: SqlRange[];
    statements: SqlStatement[];
    error: { text: string; line: number; column: number } | undefined;
};
