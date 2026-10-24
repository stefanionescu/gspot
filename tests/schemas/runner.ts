import { z } from 'zod';
import type { RuntimePins } from '#tests/types/runner.ts';

export const runtimePinsSchema = z.object({
    tools: z.object({ bun: z.string(), node: z.string() }),
}) satisfies z.ZodType<RuntimePins>;
