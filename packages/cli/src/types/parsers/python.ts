import type { Node, Tree } from 'web-tree-sitter';

/** One parsed Python source module and its caller-owned tree. */
export type PythonModule = {
    path: string;
    lines: string[];
    tree: Tree;
    /** Top-level statements with decorated definitions unwrapped. */
    statements: Node[];
};

/** One named function or lambda, with its docstring omitted from the body. */
export type PythonFunction = { path: string; name: string; node: Node; body: Node[] };

/** Python observations borrowed while a parser visitor runs. */
export type PythonFiles = { modules: PythonModule[]; functions: PythonFunction[] };
