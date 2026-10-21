import { z } from 'zod';
import type { RuffRule, RuffConfiguration } from '#tests/types/tool-output.ts';

export const ruffRulesSchema = z.array(
    z.object({ code: z.string().nullable(), preview: z.boolean() }),
) satisfies z.ZodType<RuffRule[]>;

export const ruffConfigurationSchema = z.object({
    lint: z.object({ select: z.array(z.string()) }),
}) satisfies z.ZodType<RuffConfiguration>;
