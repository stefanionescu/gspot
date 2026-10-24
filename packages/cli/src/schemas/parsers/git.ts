import { z } from 'zod';
import { GIT_MODES } from '#cli/config/parsers/git.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { GitFile, GitIndexFile } from '#cli/types/parsers/git.ts';

export const gitFileSchema = z.object({
    mode: z.enum(GIT_MODES),
    hash: z.string(),
    path: z.string(),
} satisfies SchemaShape<GitFile>);

export const gitIndexFileSchema = gitFileSchema.extend({
    stage: z.coerce.number(),
} satisfies SchemaShape<Pick<GitIndexFile, 'stage'>>);
