import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { type SemgrepOutput } from '#cli/types/runs/output/outputs.ts';

const positionSchema = z.object({
    line: z.number().int().positive(),
    col: z.number().int().positive(),
} satisfies SchemaShape<SemgrepOutput['results'][number]['start']>);

const messageSchema = z.object({ message: z.string().min(1) } satisfies SchemaShape<
    NonNullable<NonNullable<SemgrepOutput['results']>[number]['extra']>
>);

const spanSchema = z.object({ file: z.string().min(1), start: positionSchema } satisfies SchemaShape<
    NonNullable<SemgrepOutput['errors'][number]['spans']>[number]
>);

const errorTypeSchema = z.union([z.string(), z.tuple([z.string(), z.unknown()])]) satisfies z.ZodType<
    SemgrepOutput['errors'][number]['type']
>;

const errorSchema = z.object({
    code: z.number().int(),
    type: errorTypeSchema,
    message: z.string().min(1),
    path: z.string().min(1).optional(),
    spans: spanSchema.array().optional(),
} satisfies SchemaShape<SemgrepOutput['errors'][number]>);

export const semgrepOutputSchema = z.object({
    results: z
        .object({
            check_id: z.string().min(1),
            path: z.string().min(1),
            start: positionSchema,
            extra: messageSchema,
        } satisfies SchemaShape<NonNullable<SemgrepOutput['results']>[number]>)
        .array(),
    errors: errorSchema.array(),
} satisfies SchemaShape<SemgrepOutput>);
