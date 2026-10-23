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
    body: string[];
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
    lineOffset: number;
    owner: number | undefined;
    registry: ScriptTemporaryPaths;
    lines: Map<number, Array<TemporaryPath | undefined>>;
};

export type ScriptSyntax = {
    code: string[];
    functions: ScriptFunction[];
    calls: CommandCall[];
    temporaryPaths: TemporaryPath[];
};
