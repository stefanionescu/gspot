import type { z } from 'zod';
import type { ruleSettingsSchema } from '#cli/parsers/schema/contracts.ts';

/** Semantic rule values retained before native configuration serialization. */
export type CapturedRules = z.infer<typeof ruleSettingsSchema>;
