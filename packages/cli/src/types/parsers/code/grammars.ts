import type { Node, Parser } from 'web-tree-sitter';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { GRAMMAR_NAMES } from '#cli/config/parsers/code/grammars.ts';

/** Files, each with the grammar that a check chose. */
type ParsedFile = { path: string; grammar: GrammarName };

export type GrammarName = (typeof GRAMMAR_NAMES)[number];

export type ParseCache = { reads: ReadCache; resources?: DisposableStack };

/** The repository files to parse, with the cache that owns their parse results. */
export type SourceFiles = ParseCache & { files: { path: string; kind: string }[] };

/** The files to parse, each with its grammar, and the repository cache. */
export type GrammarSourceFiles = ParseCache & { files: ParsedFile[] };

/** A tree borrowed only for the duration of a synchronous source visitor. */
export type SourceTree = { path: string; text: string; rootNode: Node };

/** Initialization and grammar instances shared for the lifetime of the process. */
export type ParserGrammars = {
    runtime: Promise<void> | undefined;
    parsers: Map<GrammarName, Promise<Parser>>;
};
