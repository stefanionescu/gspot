import type { Node, Tree } from 'web-tree-sitter';

export type CountedLanguage = 'python' | 'swift' | 'bash';

export type IsSubstantial = (node: Node, language: CountedLanguage, limit: number) => boolean;

/** A tracked folder entry. */
export type FolderEntry = { name: string; kind: 'file' | 'folder' };

/** Parsed trees and their captures used by the convention checks. */
export type ConventionSource = { path: string; language: CountedLanguage; tree: Tree; captures: Map<string, Node[]> };
