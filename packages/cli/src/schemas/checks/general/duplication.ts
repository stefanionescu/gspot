import { z } from 'zod';

const cloneLocationSchema = z.object({
    name: z.string().min(1),
    start: z.number().int().positive(),
});

export const jscpdOutputSchema = z.object({
    duplicates: z
        .object({
            lines: z.number().int().positive(),
            firstFile: cloneLocationSchema,
            secondFile: cloneLocationSchema,
        })
        .array(),
});
