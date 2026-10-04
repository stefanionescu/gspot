// Validate the fields captured from an index or committed-tree entry.
import { z } from 'zod';

export const gitEntrySchema = z.object({
    mode: z.enum(['100644', '100755', '120000', '160000']),
    hash: z.string(),
    path: z.string(),
});
