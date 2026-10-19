import type { Node } from 'web-tree-sitter';

/** A module name and the repository file it loads. */
export type ImportTarget = { module: string; target: string };

/** An import that names a file in the repository: the statement, the module as written, and the file it loads. */
export type LocatedImport = ImportTarget & { node: Node };

/** An import statement, the module as written, and the import rule of each file it loads. */
export type ImportOwners = { node: Node; module: string; owners: (number | undefined)[] };

/** Where Python looks for the modules that an import names. */
export type PythonSearch = { files: ReadonlySet<string>; roots: string[]; externals: ReadonlySet<string> };

/** A Swift module of the repository and its files. */
export type SwiftModule = { name: string; files: string[] };
