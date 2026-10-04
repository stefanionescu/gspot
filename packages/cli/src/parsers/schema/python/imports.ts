import { z } from 'zod';

export const importLinterSchema = z.object({
    tool: z.object({ importlinter: z.record(z.string(), z.unknown()).optional() }).optional(),
});
