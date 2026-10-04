import type { z } from 'zod';

import type {
    eslintPresetsSchema,
    eslintAllRulesSchema,
    eslintCoverageRequest,
    eslintRuleNamesSchema,
    eslintCoverageResponse,
} from '#cli/parsers/schema/eslint.ts';

/** Repository source paths whose active rules must be inspected. */
export type EslintCoverageRequest = z.infer<typeof eslintCoverageRequest>;
/** Active rule names reported for every inspected source path. */
export type EslintCoverageResponse = z.infer<typeof eslintCoverageResponse>;

/** Default rules that are active only at level all. */
export type EslintAllRules = z.output<typeof eslintAllRulesSchema>;

/** The exact package identity and actual core rule names from its public export. */
export type EslintRuleNames = z.output<typeof eslintRuleNamesSchema>;

/** Snapshot data read before a configuration renders. */
export type EslintPresets = z.infer<typeof eslintPresetsSchema>;
