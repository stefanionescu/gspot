import { z } from 'zod';

export const ruffRuleSchema = z.object({ name: z.string().optional(), summary: z.string().optional() });

/** Rule values captured before serialization, grouped by their declared manifest paths. */
export const ruleSettingsSchema = z.record(z.string(), z.record(z.string(), z.json()));
