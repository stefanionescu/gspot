import type { Node, Tree } from 'web-tree-sitter';
import type { ReadCache } from '#cli/types/platform/reads.ts';

/** One Swift function, accessor, observer, or closure and its executable body. */
export type SwiftFunction = { path: string; node: Node; name: string; body: Node[] };

/** One Swift source file and the tree borrowed by a parser visitor. */
export type SwiftSource = { path: string; text: string; lines: string[]; tree: Tree };

/** Swift observations shared during one run. */
export type ParsedSwift = { sources: SwiftSource[]; functions: SwiftFunction[] };

/** Native package directory and reads for compiler version resolution. */
export type SwiftVersionInput = { root: string; scope: string; reads: ReadCache };
