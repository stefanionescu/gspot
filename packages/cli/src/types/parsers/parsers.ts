// The types of parsers in this package.
import type { SourceObservations } from '#cli/types/repository/repository.ts';

export type GrammarName = 'typescript' | 'tsx' | 'javascript' | 'bash' | 'python' | 'swift' | 'html' | 'css';
export type ParseContext = { observations: SourceObservations; resources?: DisposableStack };
