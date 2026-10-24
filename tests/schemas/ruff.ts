import { z } from 'zod';
import type { RuffRule, RuffConfigFile } from '#tests/types/tools.ts';

export const ruffRulesSchema = z
    .object({ code: z.string().nullable(), preview: z.boolean() })
    .array() satisfies z.ZodType<RuffRule[]>;

export const ruffConfigurationSchema = z.object({
    lint: z.object({ select: z.string().array() }),
}) satisfies z.ZodType<{ lint: Pick<RuffConfigFile['lint'], 'select'> }>;
