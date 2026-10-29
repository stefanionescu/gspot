import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { DenoLintOutput, SupabaseProjectFile } from '#cli/types/checks/platform/supabase.ts';

const storageSchema = z.object({ buckets: z.record(z.string(), z.unknown()).optional() } satisfies SchemaShape<
    NonNullable<SupabaseProjectFile['storage']>
>);

export const supabaseProjectFileSchema = z.object({
    storage: storageSchema.optional(),
    functions: z
        .record(
            z.string(),
            z.object({ entrypoint: z.string().optional(), import_map: z.string().optional() } satisfies SchemaShape<
                NonNullable<SupabaseProjectFile['functions']>[string]
            >),
        )
        .optional(),
} satisfies SchemaShape<SupabaseProjectFile>);
const startSchema = z.object({ line: z.number().int().positive() } satisfies SchemaShape<
    DenoLintOutput['diagnostics'][number]['range']['start']
>);

export const denoLintOutputSchema = z.object({
    diagnostics: z
        .object({
            filename: z.string(),
            code: z.string(),
            message: z.string(),
            range: z.object({
                start: startSchema,
            } satisfies SchemaShape<DenoLintOutput['diagnostics'][number]['range']>),
        } satisfies SchemaShape<DenoLintOutput['diagnostics'][number]>)
        .array(),
    errors: z
        .object({ file_path: z.string(), message: z.string() } satisfies SchemaShape<DenoLintOutput['errors'][number]>)
        .array(),
} satisfies SchemaShape<DenoLintOutput>);
