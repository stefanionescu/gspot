import { z } from 'zod';

export const ruffRuleSchema = z.object({ name: z.string().optional(), summary: z.string().optional() });
