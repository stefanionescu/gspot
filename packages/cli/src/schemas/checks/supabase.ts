import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { DenoLintReport, SupabaseConfiguration } from '#cli/types/checks/supabase.ts';

export const supabaseProjectSchema = z.object({
    storage: z
        .object({ buckets: z.record(z.string(), z.unknown()).optional() } satisfies SchemaShape<
            NonNullable<SupabaseConfiguration['storage']>
        >)
        .optional(),
} satisfies SchemaShape<SupabaseConfiguration>) satisfies z.ZodType<SupabaseConfiguration>;

export const denoLintReportSchema = z.object({
    diagnostics: z.array(
        z.object({
            filename: z.string(),
            code: z.string(),
            message: z.string(),
            range: z.object({
                start: z.object({ line: z.number().int().positive() } satisfies SchemaShape<
                    DenoLintReport['diagnostics'][number]['range']['start']
                >),
            } satisfies SchemaShape<DenoLintReport['diagnostics'][number]['range']>),
        } satisfies SchemaShape<DenoLintReport['diagnostics'][number]>),
    ),
    errors: z.array(
        z.object({ file_path: z.string(), message: z.string() } satisfies SchemaShape<
            DenoLintReport['errors'][number]
        >),
    ),
} satisfies SchemaShape<DenoLintReport>) satisfies z.ZodType<DenoLintReport>;
