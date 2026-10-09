import type { ParseReads } from '#cli/types/parsers/source.ts';

/** A shell function, its one-based range, executable statements, and positional-argument reads. */
export type ScriptFunction = {
    name: string;
    start: number;
    end: number;
    body: string[];
    statements: number;
    highestRead: number;
};

/** A shell command's name, argument count, and one-based line. */
export type FunctionCall = { name: string; count: number; line: number };

/** One multiline quoted argument and the shell command that receives it. */
export type QuotedArgument = { command: string; start: number; end: number };

/** A comment-free code line, keyed by its one-based number. */
export type CodeLine = { number: number; code: string };

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

/** The shell syntax every check shares after the tree is disposed. */
export type ScriptSyntax = {
    code: string[];
    functions: ScriptFunction[];
    calls: FunctionCall[];
    quotedArguments: QuotedArgument[];
    temporaryPaths: TemporaryPath[];
    isTrivialFile: boolean;
};

export type BashParseOptions = { minimumStatements: number | undefined; context?: ParseReads };
