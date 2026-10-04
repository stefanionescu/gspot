import { z } from 'zod';
import { percentageSchema } from '#cli/parsers/schema/primitives.ts';

const clonePlaceSchema = z.object({
    name: z.string().min(1),
    start: z.number().int().positive(),
    end: z.number().int().positive(),
});

export const cloneReportSchema = z.object({
    statistics: z.object({ total: z.object({ percentage: percentageSchema }) }),
    duplicates: z.array(
        z.object({ lines: z.number().int().positive(), firstFile: clonePlaceSchema, secondFile: clonePlaceSchema }),
    ),
});
