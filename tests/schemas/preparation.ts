import { z } from 'zod';
import type { RuntimeSettings } from '#tests/types/preparation.ts';

export const runtimeSettingsSchema = z.object({
    tools: z.object({ bun: z.string(), node: z.string() }),
}) satisfies z.ZodType<RuntimeSettings>;
