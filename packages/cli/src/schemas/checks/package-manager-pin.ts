import { z } from 'zod';
import type { MiseTools } from '#cli/types/parsers/mise.ts';

export const miseToolsSchema = z.looseObject({
    tools: z.record(z.string(), z.unknown()).default({}),
}) satisfies z.ZodType<MiseTools>;
