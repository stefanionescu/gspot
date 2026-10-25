import type { Node } from '@pgsql/types';
import type { TextRange } from '#cli/types/text.ts';

export type SqlToken = {
    start: number;
    end: number;
    kind: 'block-comment' | 'line-comment' | 'dollar' | 'command' | 'variable' | 'other';
};

export type BlankedSql = { text: string; variables: TextRange[] };

export type SqlNodeFields = { [Variant in Node as keyof Variant]: Variant[keyof Variant] };

export type SqlStatement<Kind extends keyof SqlNodeFields = keyof SqlNodeFields> = {
    [Name in Kind]: { kind: Name; fields: SqlNodeFields[Name]; start: number };
}[Kind];

export type SqlStatementVisitors<Result, Arguments extends unknown[] = []> = {
    [Kind in keyof SqlNodeFields]?: (statement: SqlStatement<Kind>, ...readerArguments: Arguments) => Result;
};

export type SqlFile = {
    source: string;
    variables: TextRange[];
    statements: SqlStatement[];
    error: { text: string; line: number; column: number } | undefined;
};

export type MatchedToken = Omit<SqlToken, 'start'>;
