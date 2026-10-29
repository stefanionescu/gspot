import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { ValeOutput } from '#cli/types/checks/general/prose.ts';

const alertSchema = z.object({
    Line: z.number().int().positive(),
    Span: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    Check: z.string().min(1),
    Message: z.string().min(1),
} satisfies SchemaShape<ValeOutput[string][number]>);

export const valeOutputSchema = z.record(z.string().min(1), alertSchema.array()) satisfies z.ZodType<ValeOutput>;
