import { z } from 'zod';
import { FILE_KINDS } from '#cli/config/parsers/inventory.ts';

export const fileKindSchema = z.enum(FILE_KINDS);

/** Authored generated-source declarations retain their producer and reason. */
export const generatedSchema = z.strictObject({
    paths: z.array(z.string().min(1)).min(1),
    generator: z.string().optional(),
    reason: z.string().optional(),
});

export const vendoredSchema = z.strictObject({
    paths: z.array(z.string().min(1)).min(1),
    reason: z.string().optional(),
});
