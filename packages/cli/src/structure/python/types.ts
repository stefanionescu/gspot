import type { Node, Tree } from 'web-tree-sitter';
// Types of the Python structure analyses.
import type { EngineInput } from '#cli/types/execution.ts';

/** One parsed Python module. */
export type PythonModule = {
    path: string;
    lines: string[];
    tree: Tree;
    /** The top-level statements, with a decorated definition unwrapped to its definition. */
    statements: Node[];
};

/** One top-level or nested function with what the analyses read from it. */
export type PythonFunction = {
    path: string;
    name: string;
    node: Node;
    /** The statements of the body, the docstring left out. */
    body: Node[];
};

/** One problem an analysis found. */
export type StructureProblem = { file: string; line: number; rule: string; text: string };

/** The modules and functions of one run, parsed once. */
export type ParsedModules = { modules: PythonModule[]; functions: PythonFunction[] };

/** One structure analysis over the parsed modules. */
export type StructureReader = (parsed: ParsedModules, input: EngineInput) => StructureProblem[];
