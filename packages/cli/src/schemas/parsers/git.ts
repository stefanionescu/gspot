import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { GIT_ENTRY_MODES } from '#cli/config/repository/revisions.ts';

export const gitEntrySchema = z.object({
    mode: z.enum(GIT_ENTRY_MODES),
    hash: z.string(),
    path: z.string(),
} satisfies SchemaShape<GitEntry>) satisfies z.ZodType<GitEntry>;
