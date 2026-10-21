import type { GIT_ENTRY_MODES } from '#cli/config/parsers/git.ts';

/** A validated tracked entry with a supported Git mode and full object identity. */
export type GitEntry = { mode: (typeof GIT_ENTRY_MODES)[number]; hash: string; path: string };

/** An index entry at stage zero, or stages one through three during a merge conflict. */
export type GitIndexEntry = GitEntry & { stage: number };

/** The current transport chunk and cursor in a Git batch response. */
export type GitStream = { chunks: AsyncIterator<Buffer>; chunk: Buffer; cursor: number };

export type AttributePattern = { pattern: string; attributes: string[] };
