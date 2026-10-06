import { z } from 'zod';

const positionSchema = z.object({ line: z.number().int().positive(), col: z.number().int().positive() });

export const semgrepReportSchema = z.object({
    results: z.array(
        z.object({
            check_id: z.string().min(1),
            path: z.string().min(1),
            start: positionSchema,
            extra: z.object({ message: z.string().min(1) }),
        }),
    ),
    errors: z.array(
        z.object({
            code: z.number().int(),
            type: z.union([z.string(), z.tuple([z.string(), z.unknown()])]),
            message: z.string().min(1),
            path: z.string().min(1).optional(),
            spans: z.array(z.object({ file: z.string().min(1), start: positionSchema })).optional(),
        }),
    ),
});
