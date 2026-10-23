import type { MARKERS } from '#cli/config/parsers/formats/managed-blocks.ts';

export type BlockSpan = { start: number; end: number };

export type BlockStyle = keyof typeof MARKERS;

export type BlockFile = { path: string; style: BlockStyle };
