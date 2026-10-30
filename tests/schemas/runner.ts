import { z } from 'zod';

export const runtimePinsSchema = z.object({
    tools: z.object({ bun: z.string(), node: z.string() }),
});
