import type { MARKERS } from '#cli/config/parsers/formats/managed-blocks.ts';

export type BlockStyle = keyof typeof MARKERS;

export type BlockFile = { path: string; style: BlockStyle };
