import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { DenoLintReport, SupabaseProjectFile } from '#cli/types/checks/platform/supabase.ts';

export const supabaseProjectFileSchema = z.object({
    storage: z
        .object({ buckets: z.record(z.string(), z.unknown()).optional() } satisfies SchemaShape<
            NonNullable<SupabaseProjectFile['storage']>
        >)
        .optional(),
} satisfies SchemaShape<SupabaseProjectFile>);

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
} satisfies SchemaShape<DenoLintReport>);
