import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { ValeReport } from '#cli/types/checks/prose.ts';

export const valeReportSchema = z.record(
    z.string().min(1),
    z.array(
        z.object({
            Line: z.number().int().positive(),
            Span: z.tuple([z.number().int().positive(), z.number().int().positive()]),
            Check: z.string().min(1),
            Message: z.string().min(1),
        } satisfies SchemaShape<
            Record<string, { Line: number; Span: [number, number]; Check: string; Message: string }[]>[string][number]
        >),
    ),
) satisfies z.ZodType<ValeReport>;
