import { z } from 'zod';

export const svelteFailureSchema = z.string();

export const diagnosticSchema = z.object({
    type: z.enum(['ERROR', 'WARNING']),
    filename: z.string().min(1),
    start: z.object({ line: z.number().int().nonnegative(), character: z.number().int().nonnegative() }),
    message: z.string(),
    code: z.union([z.string(), z.number()]).optional(),
});
