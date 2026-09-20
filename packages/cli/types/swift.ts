import type { EngineInput } from '#types/run.ts';
// Types of the swift checks.
import type { Node, Tree } from 'web-tree-sitter';
import type { StructureProblem } from '#types/pyproject.ts';

/** The build of one Swift scope. */
export type SwiftBuildPlan = {
    /** The folder the build runs in. */
    cwd: string;
    /** The cache folder of this scope. */
    folder: string;
    /** Where the compiler log is written. */
    log: string;
    argv: string[];
    /** A folder the build owns and empties first, so the log holds every compiler call and not only the changed files. */
    scratch?: string;
};

/** The observed build status and its compiler output. */
export type SwiftBuildOutput = { code: number; output: string };

/** One parsed Swift file of a run. */
export type SwiftSource = { path: string; text: string; lines: string[]; tree: Tree };

/** One Swift function with what the structure checks ask about it. */
export type SwiftFunction = {
    path: string;
    node: Node;
    name: string;
    /** The statements of the body. */
    body: Node[];
    /** The names the body reads its parameters by. */
    parameters: string[];
    /** True for private and fileprivate, which no other file calls. */
    isFileLocal: boolean;
    /** True when an attribute or override ties the function to a caller the file does not show. */
    isBound: boolean;
};

/** The files and functions of one run, parsed one time. */
export type ParsedSwift = { sources: SwiftSource[]; functions: SwiftFunction[] };

/** One structure analysis over the parsed Swift files. */
export type SwiftReader = (parsed: ParsedSwift, input: EngineInput) => StructureProblem[];
