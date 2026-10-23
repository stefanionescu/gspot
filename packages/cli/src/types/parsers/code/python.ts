import type { Node, Tree } from 'web-tree-sitter';

export type PythonModule = {
    path: string;
    lines: string[];
    tree: Tree;
    statements: Node[];
};

export type PythonFunction = { path: string; name: string; node: Node; body: Node[] };

export type PythonFiles = { modules: PythonModule[]; functions: PythonFunction[] };
