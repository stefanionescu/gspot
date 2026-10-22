import { z } from 'zod';
import { eslintPresetSchema } from '#cli/schemas/configurations/eslint-presets.ts';
import { type EslintPresets } from '#cli/types/generation/configurations/language/javascript/eslint.ts';

export const eslintPresetsSchema = z.record(z.string(), eslintPresetSchema) satisfies z.ZodType<EslintPresets>;
