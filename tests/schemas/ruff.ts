import { z } from 'zod';

export const ruffRulesSchema = z.object({ code: z.string().nullable(), preview: z.boolean() }).array();

export const ruffConfigurationSchema = z.object({
    lint: z.object({ select: z.string().array() }),
});
