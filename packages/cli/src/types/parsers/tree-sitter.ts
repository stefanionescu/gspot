import type { Node, Parser } from 'web-tree-sitter';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { GRAMMAR_NAMES } from '#cli/config/parsers/tree-sitter.ts';

/** Files with grammars that a check already selected. */
type ParsedFile = { path: string; grammar: GrammarName };

export type MarkupAttribute = { name: string; value: string; element: string; node: Node };

export type GrammarName = (typeof GRAMMAR_NAMES)[number];

export type ParseCache = { reads: ReadCache; resources?: DisposableStack };

/** Selected repository files and the reads that own their parsed observations. */
export type SourceInput = ParseCache & { root: string; files: { path: string; kind: string }[] };

/** Selected files and their repository-owned reads. */
export type ParsedSourceInput = ParseCache & { root: string; files: ParsedFile[] };

/** A tree borrowed only for the duration of a synchronous source visitor. */
export type SourceTree = { path: string; text: string; rootNode: Node };

/** Initialization and grammar instances shared for the lifetime of the process. */
export type ParserState = {
    runtime: Promise<void> | undefined;
    parsers: Map<GrammarName, Promise<Parser>>;
};
