import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { type SemgrepReport } from '#cli/types/runs/tool-reports.ts';

const positionSchema = z.object({
    line: z.number().int().positive(),
    col: z.number().int().positive(),
} satisfies SchemaShape<SemgrepReport['results'][number]['start']>);
const messageSchema = z.object({ message: z.string().min(1) } satisfies SchemaShape<
    NonNullable<NonNullable<SemgrepReport['results']>[number]['extra']>
>);

const spansSchema = z.object({ file: z.string().min(1), start: positionSchema } satisfies SchemaShape<
    NonNullable<SemgrepReport['errors'][number]['spans']>[number]
>);
const errorTypeSchema = z.union([z.string(), z.tuple([z.string(), z.unknown()])]) satisfies z.ZodType<
    SemgrepReport['errors'][number]['type']
>;

const errorsSchema = z.object({
    code: z.number().int(),
    type: errorTypeSchema,
    message: z.string().min(1),
    path: z.string().min(1).optional(),
    spans: spansSchema.array().optional(),
} satisfies SchemaShape<SemgrepReport['errors'][number]>);

export const semgrepReportSchema = z.object({
    results: z
        .object({
            check_id: z.string().min(1),
            path: z.string().min(1),
            start: positionSchema,
            extra: messageSchema,
        } satisfies SchemaShape<NonNullable<SemgrepReport['results']>[number]>)
        .array(),
    errors: errorsSchema.array(),
} satisfies SchemaShape<SemgrepReport>);
