import type { z } from 'zod';
import type { ruleSettingsSchema } from '#cli/parsers/schema/rules.ts';

/** Semantic rule values retained before native configuration serialization. */
export type RuleSettings = z.infer<typeof ruleSettingsSchema>;
