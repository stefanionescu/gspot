import type { MARKERS } from '#cli/config/parsers/managed-blocks.ts';

export type BlockSpan = { start: number; end: number };

export type BlockStyle = keyof typeof MARKERS;

/** The file path and comment style for managed-block operations. */
export type BlockFile = { path: string; style: BlockStyle };
