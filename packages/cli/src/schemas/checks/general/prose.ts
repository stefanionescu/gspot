import { z } from 'zod';

const alertSchema = z.object({
    Line: z.number().int().positive(),
    Span: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    Check: z.string().min(1),
    Message: z.string().min(1),
});

export const valeOutputSchema = z.record(z.string().min(1), alertSchema.array());
