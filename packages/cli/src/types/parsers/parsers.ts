import type { z } from 'zod';
import type { gitFileSchema, gitIndexFileSchema } from '#cli/schemas/parsers/parsers.ts';

export type GitFile = z.infer<typeof gitFileSchema>;

export type GitIndexFile = z.infer<typeof gitIndexFileSchema>;

export type GitStream = { chunks: AsyncIterator<Buffer>; chunk: Buffer; cursor: number };

export type AttributePattern = { pattern: string; attributes: string[] };
