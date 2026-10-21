import { z } from 'zod';
import type { NameList } from '#cli/types/configurations.ts';

export const nameListSchema = z.strictObject({
    package: z.string().min(1),
    version: z.string().min(1),
    source: z.string().min(1),
    names: z.array(z.string().min(1)),
}) satisfies z.ZodType<NameList>;
