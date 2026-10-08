import type { z } from 'zod';
import type { eslintPresetsSchema, eslintAllRulesSchema, eslintRuleNamesSchema } from '#cli/parsers/schema/public.ts';

/** Default rules that are active only at level all. */
export type EslintAllRules = z.output<typeof eslintAllRulesSchema>;

/** The exact package identity and actual core rule names from its public export. */
export type EslintRuleNames = z.output<typeof eslintRuleNamesSchema>;

/** Preset data read before emitting a configuration. */
export type EslintPresets = z.infer<typeof eslintPresetsSchema>;
