import { z } from 'zod';
import type { MiseTools } from '#cli/types/checks/general/package-manager-pin.ts';

export const miseToolsSchema = z.looseObject({
    tools: z.record(z.string(), z.unknown()).default({}),
}) satisfies z.ZodType<MiseTools>;
