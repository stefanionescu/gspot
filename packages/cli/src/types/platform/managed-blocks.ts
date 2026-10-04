import type { BLOCK_STYLES } from '#cli/config/platform/managed-blocks.ts';

export type BlockSpan = { start: number; end: number };

export type BlockStyle = (typeof BLOCK_STYLES)[number];

/** The delimiters surrounding one owned instruction block. */
export type BlockMarkers = { start: string; end: string };
