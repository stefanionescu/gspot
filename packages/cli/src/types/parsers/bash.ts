/** A shell command's name, argument count, and one-based line. */
type FunctionCall = {
    name: string;
    count: number;
    line: number;
}; /** A shell function, its one-based range, executable statements, and positional-argument reads. */
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

/** Created paths remain visible even when reassignment prevents an exact cleanup binding. */
export type TemporaryTargets = { paths: TemporaryPath[]; targets: Map<string, TemporaryPath>; declared: Set<string> };

/** A deferred trap's native removals retain their source offset and variable ownership. */
export type CleanupContext = {
    lineOffset: number;
    owner: number | undefined;
    registry: TemporaryTargets;
    lines: Map<number, Array<TemporaryPath | undefined>>;
};

/** The shell syntax every check shares after disposing of the tree. */
export type ScriptSyntax = {
    code: string[];
    functions: ScriptFunction[];
    calls: FunctionCall[];
    temporaryPaths: TemporaryPath[];
};
