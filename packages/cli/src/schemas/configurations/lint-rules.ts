import { z } from 'zod';
import type { LintRules } from '#cli/types/configurations.ts';

export const lintRulesSchema = z.strictObject({
    package: z.string().min(1),
    version: z.string().min(1),
    source: z.string().min(1),
    rules: z.array(z.string().min(1)),
}) satisfies z.ZodType<LintRules>;
