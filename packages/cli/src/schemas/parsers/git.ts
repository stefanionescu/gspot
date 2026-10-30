import { z } from 'zod';
import { GIT_MODES } from '#cli/config/parsers/git.ts';

export const gitFileSchema = z.object({
    mode: z.enum(GIT_MODES),
    hash: z.string(),
    path: z.string(),
});

export const gitIndexFileSchema = gitFileSchema.extend({
    stage: z.coerce.number(),
});
