// Validate Supabase project declarations and the structured diagnostics of edge functions.
import { z } from 'zod';

export const supabaseProjectSchema = z.object({
    functions: z.record(z.string(), z.unknown()).optional(),
    storage: z.object({ buckets: z.record(z.string(), z.unknown()).optional() }).optional(),
});

export const denoLintReportSchema = z.object({
    diagnostics: z.array(
        z.object({
            filename: z.string(),
            code: z.string(),
            message: z.string(),
            range: z.object({ start: z.object({ line: z.number().int().positive() }) }),
        }),
    ),
    errors: z.array(z.object({ file_path: z.string(), message: z.string() })),
});
