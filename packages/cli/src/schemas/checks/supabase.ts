import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { DenoLintReport, SupabaseProjectFile } from '#cli/types/checks/platform/supabase.ts';

const storageSchema = z.object({ buckets: z.record(z.string(), z.unknown()).optional() } satisfies SchemaShape<
    NonNullable<SupabaseProjectFile['storage']>
>);

export const supabaseProjectFileSchema = z.object({
    storage: storageSchema.optional(),
} satisfies SchemaShape<SupabaseProjectFile>);
const startSchema = z.object({ line: z.number().int().positive() } satisfies SchemaShape<
    DenoLintReport['diagnostics'][number]['range']['start']
>);

export const denoLintReportSchema = z.object({
    diagnostics: z
        .object({
            filename: z.string(),
            code: z.string(),
            message: z.string(),
            range: z.object({
                start: startSchema,
            } satisfies SchemaShape<DenoLintReport['diagnostics'][number]['range']>),
        } satisfies SchemaShape<DenoLintReport['diagnostics'][number]>)
        .array(),
    errors: z
        .object({ file_path: z.string(), message: z.string() } satisfies SchemaShape<DenoLintReport['errors'][number]>)
        .array(),
} satisfies SchemaShape<DenoLintReport>);
