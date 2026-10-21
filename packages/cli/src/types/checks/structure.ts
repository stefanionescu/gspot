import type { Node, Tree } from 'web-tree-sitter';
import type { ImportRule } from '#cli/types/settings/import-rules.ts';

export type ParsedLanguage = 'python' | 'swift' | 'bash';

export type IsNontrivial = (node: Node, language: ParsedLanguage, limit: number) => boolean;

/** A tracked folder entry. */
export type FolderEntry = { name: string; kind: 'file' | 'folder' };

/** Parsed trees and their captures used by the convention checks. */
export type ParsedSource = { path: string; language: ParsedLanguage; tree: Tree; captures: Map<string, Node[]> };

export type ImportedFile = { module: string; path: string };

export type LocatedImport = ImportedFile & { node: Node };

export type ImportOwners = { node: Node; module: string; owners: (number | undefined)[] };

export type PythonSearch = { files: ReadonlySet<string>; roots: string[]; externals: ReadonlySet<string> };

export type SwiftModule = { name: string; files: string[] };

export type RuleLookup = { rules: ImportRule[]; ownerOf: (path: string) => number | undefined; allowed: string[][] };
