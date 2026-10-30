import { z } from 'zod';

export const miseToolsSchema = z.looseObject({
    tools: z.record(z.string(), z.unknown()).default({}),
});
