import type { Node, Tree } from 'web-tree-sitter';
import type { ImportRule } from '#cli/types/settings/import-rules.ts';

export type ParsedLanguage = 'python' | 'swift' | 'bash';

/** One file or child folder of a folder. */
export type FolderChild = { name: string; kind: 'file' | 'folder' };

/**
 * One parsed file for the convention checks: its path, language, syntax tree, and the nodes that each query name
 * matched.
 */
export type ParsedSource = { path: string; language: ParsedLanguage; tree: Tree; captures: Map<string, Node[]> };

export type ImportedFile = { module: string; path: string };

export type LocatedImport = ImportedFile & { node: Node };

export type ImportOwners = { node: Node; module: string; owners: (number | undefined)[] };

export type PythonSearch = { files: ReadonlySet<string>; roots: string[]; externals: ReadonlySet<string> };

export type SwiftModule = { name: string; files: string[] };

export type RuleLookup = { rules: ImportRule[]; ownerOf: (path: string) => number | undefined; allowed: string[][] };
