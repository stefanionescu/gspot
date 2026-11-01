import { z } from 'astro/zod';
import { CLI_REFERENCE } from '#cli/reference.ts';

export const guideSchema = z.object({
    title: z.string(),
    configurations: z.array(z.enum(CLI_REFERENCE.configurations.map(({ name }) => name))).default([]),
    checksTable: z.string().optional(),
});
