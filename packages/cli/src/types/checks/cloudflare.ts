import type { NumberedLine } from '#cli/types/text.ts';

/** One path rule and the headers it sets, with original source lines. */
export type HeaderBlock = { path: string; line: number; headers: { name: string; value: string; line: number }[] };

/** Parsed header rules and their syntax errors. */
export type HeaderBlocks = { blocks: HeaderBlock[]; findings: NumberedLine[] };
