import type { GIT_ENTRY_MODES } from '#cli/config/repository/revisions.ts';

/** A validated tracked entry with a supported Git mode and full object identity. */
export type GitEntry = { mode: (typeof GIT_ENTRY_MODES)[number]; hash: string; path: string };

/** An index entry at stage zero, or stages one through three during a merge conflict. */
export type GitIndexEntry = GitEntry & { stage: number };

/** The current transport chunk and cursor in a Git batch response. */
export type GitStream = { chunks: Iterator<Buffer> | AsyncIterator<Buffer>; chunk: Buffer; cursor: number };

export type AttributeRule = { pattern: string; attributes: string[] };
