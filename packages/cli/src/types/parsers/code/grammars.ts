import type { Node, Parser } from 'web-tree-sitter';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { GRAMMAR_NAMES } from '#cli/config/parsers/code/grammars.ts';

type ParsedFile = { path: string; grammar: GrammarName };

export type GrammarName = (typeof GRAMMAR_NAMES)[number];

export type ParseCache = { reads: ReadCache; resources?: DisposableStack };

export type SourceFiles = ParseCache & { files: { path: string; kind: string }[] };

export type GrammarSourceFiles = ParseCache & { files: ParsedFile[] };

export type SourceTree = { path: string; text: string; rootNode: Node };

export type ParserGrammars = {
    runtime: Promise<void> | undefined;
    parsers: Map<GrammarName, Promise<Parser>>;
};
