// The types of parsers in this package.
import type { SourceReads } from '#cli/types/repository/repository.ts';

export type GrammarName =
    | 'typescript'
    | 'tsx'
    | 'javascript'
    | 'bash'
    | 'python'
    | 'swift'
    | 'html'
    | 'css'
    | 'ruby'
    | 'toml';
export type ParseContext = { reads: SourceReads; resources?: DisposableStack };

export type SourceComment = { line: number; text: string; standalone: boolean };
