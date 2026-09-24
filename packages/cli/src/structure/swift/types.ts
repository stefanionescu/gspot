import type { EngineInput } from '#cli/types/execution.ts';
// Types of the swift checks.
import type { Node, Tree } from 'web-tree-sitter';
import type { StructureProblem } from '#cli/structure/python/types.ts';

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
