import { z } from 'zod';
import { PREPARED_SUITES } from '#tests/data/test-setup.ts';
import type { PreparedSuite, RuntimeSettings } from '#tests/types/preparation.ts';

export const suiteSchema = z.enum(PREPARED_SUITES) satisfies z.ZodType<PreparedSuite>;

export const runtimeSettingsSchema = z.object({
    tools: z.object({ bun: z.string(), node: z.string() }),
}) satisfies z.ZodType<RuntimeSettings>;
