import type { BLOCK_STYLES } from '#cli/config/system/managed-blocks.ts';

export type BlockSpan = { start: number; end: number };

export type BlockStyle = (typeof BLOCK_STYLES)[number];

/** The file path and comment style for managed-block operations. */
export type BlockContext = { path: string; style: BlockStyle };
