import type { Node, Parser } from 'web-tree-sitter';
import type { ReadCache } from '#cli/types/platform/reads.ts';

export type GrammarName = 'typescript' | 'tsx' | 'javascript' | 'bash' | 'python' | 'swift' | 'html' | 'css';

export type ParseReads = { reads: ReadCache; resources?: DisposableStack };

/** Selected repository files and the reads that own their parsed observations. */
export type SourceInput = ParseReads & { root: string; files: { path: string; kind: string }[] };

/** Files whose grammars have already been selected by a check. */
export type ParsedFile = { path: string; grammar: GrammarName };

/** Selected files and their repository-owned reads. */
export type ParsedSourceInput = ParseReads & { root: string; files: ParsedFile[] };

/** A tree borrowed only for the duration of a synchronous source visitor. */
export type ParsedSource = { path: string; text: string; rootNode: Node };

export type ProseLine = { number: number; line: string };

/** Initialization and grammar instances shared for the lifetime of the process. */
export type ParserState = {
    runtime: Promise<void> | undefined;
    parsers: Map<GrammarName, Promise<Parser>>;
};

/** Text and its one-based source line for asset parsing and syntax diagnostics. */
export type NumberedLine = { text: string; number: number };

/** A parsed value borrowed until this handle or its run owner is disposed. */
export type ParsedVisit<Value> = { value: Value; [Symbol.dispose](): void };
