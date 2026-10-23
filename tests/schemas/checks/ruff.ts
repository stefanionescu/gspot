import { z } from 'zod';
import type { RuffRule, RuffConfigFile } from '#tests/types/tools.ts';

export const ruffRulesSchema = z.array(
    z.object({ code: z.string().nullable(), preview: z.boolean() }),
) satisfies z.ZodType<RuffRule[]>;

export const ruffConfigurationSchema = z.object({
    lint: z.object({ select: z.array(z.string()) }),
}) satisfies z.ZodType<{ lint: Pick<RuffConfigFile['lint'], 'select'> }>;
