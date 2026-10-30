import { z } from 'zod';

const uvIndexSchema = z.looseObject({ url: z.string() });

export const uvSettingsSchema = z.looseObject({
    'find-links': z.string().array().optional(),
    index: uvIndexSchema.array().optional(),
});

export const uvProjectSettingsSchema = z.object({
    tool: z
        .object({
            uv: uvSettingsSchema.default({}),
        })
        .default({ uv: {} }),
});
