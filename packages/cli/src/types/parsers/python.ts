import type { z } from 'zod';
import type { Node, Tree } from 'web-tree-sitter';
import type { lockSchema } from '#cli/parsers/schema/python/tools.ts';
import type { pyprojectSchema } from '#cli/parsers/schema/python/style.ts';

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

/** The validated uv lock of the Python tool project. */
export type PythonToolLock = z.infer<typeof lockSchema>;

/** A dependency requirement recorded by uv for constraints and root metadata. */
export type PythonRequirement = NonNullable<NonNullable<PythonToolLock['manifest']>['constraints']>[number];

/** Authored uv configuration sources, with uv.toml taking precedence over pyproject.toml. */
export type PythonSettingsSources = { uv: string | undefined; project: string | undefined };

/** Repository index settings and the credentials that generated output must omit. */
export type PythonIndexSettings = { settings: Record<string, unknown>; credentials: string[] };

/** The styles accepted by the native Python docstring checker. */
export type PythonDocstringStyle = NonNullable<z.infer<typeof pyprojectSchema>['tool']['pydoclint']['style']>;
