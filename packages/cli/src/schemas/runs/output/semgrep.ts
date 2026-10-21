import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { type SemgrepReport } from '#cli/types/runs/tool-reports.ts';

const positionSchema = z.object({
    line: z.number().int().positive(),
    col: z.number().int().positive(),
} satisfies SchemaShape<SemgrepReport['results'][number]['start']>);

export const semgrepReportSchema = z.object({
    results: z.array(
        z.object({
            check_id: z.string().min(1),
            path: z.string().min(1),
            start: positionSchema,
            extra: z.object({ message: z.string().min(1) } satisfies SchemaShape<
                NonNullable<NonNullable<SemgrepReport['results']>[number]['extra']>
            >),
        } satisfies SchemaShape<NonNullable<SemgrepReport['results']>[number]>),
    ),
    errors: z.array(
        z.object({
            code: z.number().int(),
            type: z.union([z.string(), z.tuple([z.string(), z.unknown()])]) satisfies z.ZodType<
                SemgrepReport['errors'][number]['type']
            >,
            message: z.string().min(1),
            path: z.string().min(1).optional(),
            spans: z
                .array(
                    z.object({ file: z.string().min(1), start: positionSchema } satisfies SchemaShape<
                        NonNullable<SemgrepReport['errors'][number]['spans']>[number]
                    >),
                )
                .optional(),
        } satisfies SchemaShape<SemgrepReport['errors'][number]>),
    ),
} satisfies SchemaShape<SemgrepReport>) satisfies z.ZodType<SemgrepReport>;
