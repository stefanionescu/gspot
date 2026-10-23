/** A shell command, its line and argument count, and whether it forwards positional parameters. */
type CommandCall = {
    name: string;
    count: number;
    line: number;
    forwards: boolean;
};

/** A shell function, its one-based range, executable statements, and positional-argument reads. */
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

/** A mktemp assignment and the trap lines that remove its unchanged path. */
export type TemporaryPath = { name: string; line: number; cleanupLines: number[] };

/**
 * Every mktemp path, the paths that a cleanup can name by their variable, and the variables that each function
 * declares.
 */
export type ScriptTemporaryPaths = {
    paths: TemporaryPath[];
    variables: Map<string, TemporaryPath>;
    assigned: Set<string>;
};

/** The removals of a deferred trap keep their source offset and variable owner. */
export type TrapCleanup = {
    lineOffset: number;
    owner: number | undefined;
    registry: ScriptTemporaryPaths;
    lines: Map<number, Array<TemporaryPath | undefined>>;
};

/** The shell syntax every check shares after disposing of the tree. */
export type ScriptSyntax = {
    code: string[];
    functions: ScriptFunction[];
    calls: CommandCall[];
    temporaryPaths: TemporaryPath[];
};
