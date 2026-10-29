import type { Node } from 'web-tree-sitter';

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
