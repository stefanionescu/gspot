// The one-key schema of gspot.local.toml.
import { z } from 'zod';

export const localSchema = z.strictObject({
    skip: z.array(z.string()).optional(),
});
