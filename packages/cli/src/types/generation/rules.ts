import type { z } from 'zod';
import type { ruleSettingsSchema } from '#cli/parsers/schema/tool-rule.ts';

/** Semantic rule values retained before native configuration serialization. */
export type CapturedRules = z.infer<typeof ruleSettingsSchema>;
