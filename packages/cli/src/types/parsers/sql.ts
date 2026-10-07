import type { Node, ParseResult } from '@pgsql/types';

/** Source span and kind of one PostgreSQL literal or psql client token. */
export type SqlToken = {
    start: number;
    end: number;
    kind: 'block-comment' | 'line-comment' | 'dollar' | 'command' | 'variable' | 'other';
};

/** Original UTF-16 boundaries of one client substitution. */
export type SqlRange = { start: number; end: number };

/** SQL parser input with client commands masked and substitution locations retained. */
export type PreparedSql = { text: string; variables: SqlRange[] };

/** PostgreSQL payload fields indexed by their native node kind. */
export type SqlNodeFields = { [Entry in Node as keyof Entry]: Entry[keyof Entry] };

/** The result of a parse: the tree, or the error. */
export type SqlParse =
    | { tree: ParseResult; error: undefined }
    | { tree: undefined; error: { text: string; offset: number } };

/** A statement retains the relation between its native kind and payload. */
export type SqlStatementView<Kind extends keyof SqlNodeFields = keyof SqlNodeFields> = {
    [Name in Kind]: { kind: Name; fields: SqlNodeFields[Name]; start: number };
}[Kind];

/** Kind-specific readers preserve native payload types and each caller's required context. */
export type SqlStatementReaders<Result, Arguments extends unknown[] = []> = {
    [Kind in keyof SqlNodeFields]?: (statement: SqlStatementView<Kind>, ...args: Arguments) => Result;
};

/** A parsed file: the statements, or the error with its line and column. */
export type SqlFile = {
    source: string;
    variables: SqlRange[];
    statements: SqlStatementView[];
    error: { text: string; line: number; column: number } | undefined;
};
