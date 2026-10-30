import { z } from 'zod';

const miseVersionSchema = z.looseObject({ version: z.string() });

export const miseLockfileSchema = z.looseObject({
    tools: z.record(z.string(), miseVersionSchema.array()),
});
