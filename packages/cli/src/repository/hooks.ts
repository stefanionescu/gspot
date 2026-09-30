import { z } from 'zod';

export const hooksSchema = z.strictObject({
    push: z
        .enum(['changed', 'all'])
        .default('changed')
        .describe('Check affected paths or the full tree of each pushed revision.'),
});
