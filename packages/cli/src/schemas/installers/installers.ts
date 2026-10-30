import { z } from 'zod';

const miseVersionSchema = z.looseObject({ version: z.string() });

export const miseLockfileSchema = z.looseObject({
    tools: z.record(z.string(), miseVersionSchema.array()),
});

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
