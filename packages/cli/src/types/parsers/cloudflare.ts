/** A parsed Wrangler object, or the diagnostic that prevented parsing it. */
import type { NumberedLine } from '#cli/types/parsers/source.ts';

export type WranglerParse =
    | { table: Record<string, unknown>; problem: undefined }
    | { table: undefined; problem: string };

/** One path rule and the headers it sets, with original source lines. */
export type HeaderBlock = { path: string; line: number; headers: { name: string; value: string; line: number }[] };

/** Parsed header rules and their syntax diagnostics. */
export type HeaderBlocks = { blocks: HeaderBlock[]; findings: NumberedLine[] };
