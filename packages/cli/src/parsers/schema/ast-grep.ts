import { z } from 'zod';

const positionSchema = z.object({ line: z.number().int().nonnegative() });

export const matchSchema = z.object({
    file: z.string().min(1),
    ruleId: z.string().min(1),
    range: z.object({ start: positionSchema, end: positionSchema }),
});

export const astGrepReportSchema = z.array(matchSchema);
