import type { GrammarName } from '#cli/types/parsers/code/grammars.ts';

export type SourceComment = { line: number; text: string; standalone: boolean };

export type CommentParser = (text: string, path: string) => SourceComment[] | Promise<SourceComment[]>;

export type ComponentScript = { grammar: GrammarName; source: string };
