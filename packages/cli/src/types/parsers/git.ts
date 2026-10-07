import type { z } from 'zod';
import type { gitEntrySchema } from '#cli/parsers/schema/git.ts';

/** A validated tracked entry with a supported Git mode and full object identity. */
export type GitEntry = z.output<typeof gitEntrySchema>;

/** An index entry at stage zero, or stages one through three during a merge conflict. */
export type GitIndexEntry = GitEntry & { stage: number };

/** The current transport chunk and cursor in a Git batch response. */
export type GitStream = { chunks: Iterator<Buffer> | AsyncIterator<Buffer>; chunk: Buffer; cursor: number };
