// The types of parsers in this package.
import type { SourceObservations } from '#cli/types/repository/repository.ts';

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
export type ParseContext = { observations: SourceObservations; resources?: DisposableStack };

export type SourceComment = { line: number; text: string; standalone: boolean };
