// The types of checks/swift in this package.
import type { Node, Tree } from 'web-tree-sitter';
import type { EngineInput } from '#cli/types/checks/checks.ts';
import type { StructureProblem } from '#cli/types/checks/structure.ts';
import type { ConfinedRoot, FileSnapshot } from '#cli/types/platform.ts';

/** One parsed Swift file of a run. */
export type SwiftSource = { path: string; text: string; lines: string[]; tree: Tree };
/** One Swift function with what the structure checks ask about it. */
export type SwiftFunction = {
    path: string;
    node: Node;
    name: string;
    /** The statements of the body. */
    body: Node[];
};
/** The files and functions of one run, parsed one time. */
export type ParsedSwift = { sources: SwiftSource[]; functions: SwiftFunction[] };
/** One structure analysis over the parsed Swift files. */
export type SwiftReader = (parsed: ParsedSwift, input: EngineInput) => StructureProblem[];
export type Pruning = { folder: string; files: ConfinedRoot; desired: Map<string, FileSnapshot>; wanted: Set<string> };
/** The build of one Swift scope. */
export type SwiftBuildPlan = {
    /** The cache folder of this scope. */
    folder: string;
    /** Where the compiler log is written. */
    log: string;
    argv: string[];
    /** The analyzer clears this folder so its log includes every compiler call. */
    scratch?: string;
};
/** The observed build status and its compiler output. */
export type SwiftBuildOutput = { code: number; output: string };
