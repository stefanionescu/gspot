import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { type ReportedTypo } from '#cli/types/runs/output/reports.ts';

export const reportedTypoSchema = z.object({
    type: z.literal('typo'),
    path: z.string().min(1),
    line_num: z.number().int().positive().optional(),
    byte_offset: z.number().int().nonnegative(),
    typo: z.string().min(1),
    corrections: z.string().array().nullable(),
} satisfies SchemaShape<ReportedTypo>);
