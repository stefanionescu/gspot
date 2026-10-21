import type { Node, Parser } from 'web-tree-sitter';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { GRAMMAR_NAMES } from '#cli/config/parsers/grammars.ts';

/** Files, each with the grammar that a check chose. */
type ParsedFile = { path: string; grammar: GrammarName };

export type MarkupAttribute = { name: string; value: string; element: string; node: Node };

export type GrammarName = (typeof GRAMMAR_NAMES)[number];

export type ParseCache = { reads: ReadCache; resources?: DisposableStack };

/** The repository files to parse, with the cache that owns their parse results. */
export type SourceInput = ParseCache & { files: { path: string; kind: string }[] };

/** The files to parse, each with its grammar, and the repository cache. */
export type ParsedSourceInput = ParseCache & { files: ParsedFile[] };

/** A tree borrowed only for the duration of a synchronous source visitor. */
export type SourceTree = { path: string; text: string; rootNode: Node };

/** Initialization and grammar instances shared for the lifetime of the process. */
export type ParserState = {
    runtime: Promise<void> | undefined;
    parsers: Map<GrammarName, Promise<Parser>>;
};
