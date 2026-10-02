// The types of parsers in this package.
import type { ReadCache } from '#cli/types/platform/platform.ts';

export type ProseLine = { number: number; line: string };

export type GrammarName = 'typescript' | 'tsx' | 'javascript' | 'bash' | 'python' | 'swift' | 'html' | 'css';
export type ParseReads = { reads: ReadCache; resources?: DisposableStack };
