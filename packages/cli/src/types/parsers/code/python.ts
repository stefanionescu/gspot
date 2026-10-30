import { type Node, type Tree } from 'web-tree-sitter';
import type { ParseCache } from '#cli/types/parsers/code/grammars.ts';

export type PythonModule = {
    path: string;
    lines: string[];
    tree: Tree & Disposable;
    statements: Node[];
};

export type PythonFunction = { path: string; name: string; node: Node; body: Node[] };

export type PythonFiles = { modules: PythonModule[]; functions: PythonFunction[] };

export type SourceFiles = Required<ParseCache> & { files: { path: string; kind: string }[] };
