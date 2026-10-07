import type { z } from 'zod';
import type { Node, Tree } from 'web-tree-sitter';
import type { docstringStyleSchema } from '#cli/parsers/schema/python/docstrings.ts';

/** One parsed Python source module and its caller-owned tree. */
export type PythonModule = {
    path: string;
    lines: string[];
    tree: Tree;
    /** Top-level statements with decorated definitions unwrapped. */
    statements: Node[];
};

/** A parsed __all__ declaration and the names it exposes. */
export type PythonExports = { names: string[]; statement: Node };

/** One named function or lambda, with its docstring omitted from the body. */
export type PythonFunction = { path: string; name: string; node: Node; body: Node[] };

/** Python observations borrowed while a parser visitor runs. */
export type ParsedPython = { modules: PythonModule[]; functions: PythonFunction[] };

/** The styles accepted by the native Python docstring checker. */
export type PythonDocstringStyle = NonNullable<z.infer<typeof docstringStyleSchema>['tool']['pydoclint']['style']>;
