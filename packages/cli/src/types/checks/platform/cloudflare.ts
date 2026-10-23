import type { NumberedLine } from '#cli/types/text.ts';

export type HeaderBlock = { path: string; headers: { name: string; value: string }[] };

export type ParsedHeadersFile = { blocks: HeaderBlock[]; errors: NumberedLine[] };
