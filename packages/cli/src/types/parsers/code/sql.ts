import type { Node } from '@pgsql/types';

export type SqlToken = {
    start: number;
    end: number;
    kind: 'block-comment' | 'line-comment' | 'dollar' | 'command' | 'variable' | 'other';
};

export type SqlRange = { start: number; end: number };

export type BlankedSql = { text: string; variables: SqlRange[] };

export type SqlNodeFields = { [Entry in Node as keyof Entry]: Entry[keyof Entry] };

export type SqlStatement<Kind extends keyof SqlNodeFields = keyof SqlNodeFields> = {
    [Name in Kind]: { kind: Name; fields: SqlNodeFields[Name]; start: number };
}[Kind];

export type SqlStatementVisitors<Result, Arguments extends unknown[] = []> = {
    [Kind in keyof SqlNodeFields]?: (statement: SqlStatement<Kind>, ...readerArguments: Arguments) => Result;
};

export type SqlFile = {
    source: string;
    variables: SqlRange[];
    statements: SqlStatement[];
    error: { text: string; line: number; column: number } | undefined;
};

export type MatchedToken = Omit<SqlToken, 'start'>;
