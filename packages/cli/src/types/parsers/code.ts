import type { Node as SqlNode } from '@pgsql/types';
import type { TextRange } from '#cli/types/text.ts';
import type { Node, Tree, Parser } from 'web-tree-sitter';
import type { RunCache } from '#cli/types/system/system.ts';
import type { GRAMMAR_NAMES } from '#cli/config/parsers/code.ts';

export type TrapScript = {
    trap: Node;
    body: Node;
    syntaxRoot: Node;
    sourceRows: { offset: number; line: number }[];
};

type CommandCall = {
    name: string;
    count: number;
    line: number;
    forwards: boolean;
};

export type ScriptFunction = {
    name: string;
    start: number;
    end: number;
    highestRead: number;
    branches: number;
    nesting: number;
    assignments: number;
};

export type TemporaryPath = { name: string; line: number; cleanupLines: number[] };

export type ScriptTemporaryPaths = {
    paths: TemporaryPath[];
    variables: Map<string, TemporaryPath>;
    assigned: Set<string>;
};

export type TrapCleanup = {
    sourceRows: TrapScript['sourceRows'];
    owner: number | undefined;
    temporaryPaths: ScriptTemporaryPaths;
    lines: Map<number, Array<TemporaryPath | undefined>>;
};

export type ScriptSyntax = {
    commands: { name: string; arguments: (string | undefined)[]; line: number }[];
    swallowedLines: number[];
    statements: { kind: string; text: string; line: number }[];
    code: string[];
    functions: ScriptFunction[];
    calls: CommandCall[];
    temporaryPaths: TemporaryPath[];
};

type GrammarFile = { path: string; grammar: GrammarName };

export type GrammarName = (typeof GRAMMAR_NAMES)[number];

export type ParseCache = { cache: RunCache; resources?: DisposableStack };

export type GrammarSourceFiles = ParseCache & { files: GrammarFile[] };

export type SourceTree = { path: string; text: string; rootNode: Node };

export type ParserGrammars = {
    runtime: Promise<void> | undefined;
    parsers: Map<GrammarName, Promise<Parser>>;
};

export type SourceComment = { line: number; text: string; standalone: boolean };

export type CommentParser = (text: string, path: string) => SourceComment[] | Promise<SourceComment[]>;

export type ComponentScript = { grammar: GrammarName; source: string };

export type EnvironmentRead = { key: string | undefined; line: number; column: number };

export type EnvironmentKind = 'os' | 'environ' | 'getenv' | undefined;

export type EnvironmentScope = Map<string, EnvironmentKind>;

export type EnvironmentNames = Map<number, Map<string, { position: number; kind: EnvironmentKind }[]>>;

export type PythonModule = {
    path: string;
    lines: string[];
    tree: Tree & Disposable;
    statements: Node[];
};

export type PythonFunction = { path: string; name: string; node: Node; body: Node[] };

export type PythonFiles = { modules: PythonModule[]; functions: PythonFunction[] };

export type SourceFiles = Required<ParseCache> & { files: { path: string; kind: string }[] };

export type SqlToken = {
    start: number;
    end: number;
    kind: 'block-comment' | 'line-comment' | 'dollar' | 'command' | 'variable' | 'other';
};

export type BlankedSql = { text: string; variables: TextRange[] };

export type SqlNodeFields = { [Variant in SqlNode as keyof Variant]: Variant[keyof Variant] };

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
