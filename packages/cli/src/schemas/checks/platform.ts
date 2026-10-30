import { z } from 'zod';

const storageSchema = z.object({ buckets: z.record(z.string(), z.unknown()).optional() });

export const supabaseProjectFileSchema = z.object({
    storage: storageSchema.optional(),
    functions: z
        .record(z.string(), z.object({ entrypoint: z.string().optional(), import_map: z.string().optional() }))
        .optional(),
});
const startSchema = z.object({ line: z.number().int().positive() });

export const denoLintOutputSchema = z.object({
    diagnostics: z
        .object({
            filename: z.string(),
            code: z.string(),
            message: z.string(),
            range: z.object({
                start: startSchema,
            }),
        })
        .array(),
    errors: z.object({ file_path: z.string(), message: z.string() }).array(),
});
