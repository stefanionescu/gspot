import { z } from 'astro/zod';
import { CLI_REFERENCE } from '#cli/reference.ts';

const configurationNameSchema = z.enum(CLI_REFERENCE.configurations.map(({ name }) => name));

export const guideSchema = z.object({
    title: z.string(),
    configurations: z.array(configurationNameSchema).default([]),
    checksTable: z.string().optional(),
});
