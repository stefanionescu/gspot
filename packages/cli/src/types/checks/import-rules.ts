import type { Node } from 'web-tree-sitter';

export type ImportTarget = { module: string; target: string };

export type LocatedImport = ImportTarget & { node: Node };

export type ImportOwners = { node: Node; module: string; owners: (number | undefined)[] };

export type PythonSearch = { files: ReadonlySet<string>; roots: string[]; externals: ReadonlySet<string> };

export type SwiftModule = { name: string; files: string[] };
