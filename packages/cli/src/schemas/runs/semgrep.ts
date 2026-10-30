import { z } from 'zod';

const positionSchema = z.object({
    line: z.number().int().positive(),
    col: z.number().int().positive(),
});

const messageSchema = z.object({ message: z.string().min(1) });

const spanSchema = z.object({ file: z.string().min(1), start: positionSchema });

const errorTypeSchema = z.union([z.string(), z.tuple([z.string(), z.unknown()])]);

const errorSchema = z.object({
    code: z.number().int(),
    type: errorTypeSchema,
    message: z.string().min(1),
    path: z.string().min(1).optional(),
    spans: spanSchema.array().optional(),
});

export const semgrepOutputSchema = z.object({
    results: z
        .object({
            check_id: z.string().min(1),
            path: z.string().min(1),
            start: positionSchema,
            extra: messageSchema,
        })
        .array(),
    errors: errorSchema.array(),
});
