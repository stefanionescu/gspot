import { z } from 'zod';

export const xccovSchema = z.object({
    targets: z.array(z.object({ name: z.string().min(1), lineCoverage: z.number().min(0).max(1) })),
});
