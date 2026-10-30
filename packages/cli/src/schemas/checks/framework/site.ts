import { z } from 'zod';

export const purgecssOutputSchema = z.object({ file: z.string().min(1), rejected: z.string().array() }).array();
