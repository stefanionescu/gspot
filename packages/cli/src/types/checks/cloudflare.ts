import type { NumberedLine } from '#cli/types/text.ts';

/** One path rule and the headers it sets. */
export type HeaderBlock = { path: string; headers: { name: string; value: string }[] };

/** Parsed header rules and their syntax errors. */
export type ParsedHeadersFile = { blocks: HeaderBlock[]; errors: NumberedLine[] };
