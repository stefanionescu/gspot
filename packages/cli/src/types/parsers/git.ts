import type { z } from 'zod';
import type { gitEntrySchema } from '#cli/parsers/schema/git.ts';

/** A validated tracked entry with a supported Git mode and full object identity. */
export type GitEntry = z.output<typeof gitEntrySchema>;

/** An index entry at stage zero, or stages one through three during a merge conflict. */
export type GitIndexEntry = GitEntry & { stage: number };

/** Boundaries of one validated Git object stream frame. */
export type GitFrame = { end: number; size: number };
