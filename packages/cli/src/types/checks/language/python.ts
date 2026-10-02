// The types of checks/language/python in this package.
import type { Node, Tree } from 'web-tree-sitter';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import type { StructureProblem } from '#cli/types/checks/language/language.ts';

/** The modules and functions of one run, parsed once. */
type ParsedModules = { modules: PythonModule[]; functions: PythonFunction[] };

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

/** One structure analysis over the parsed modules. */
export type StructureReader = (parsed: ParsedModules, input: EngineInput) => StructureProblem[];
