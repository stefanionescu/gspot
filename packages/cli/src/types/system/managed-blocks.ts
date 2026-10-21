import type { MARKERS } from '#cli/config/system/managed-blocks.ts';

export type BlockSpan = { start: number; end: number };

export type BlockStyle = keyof typeof MARKERS;

/** The file path and comment style for managed-block operations. */
export type BlockContext = { path: string; style: BlockStyle };
