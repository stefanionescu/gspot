import { z } from 'zod';
import { type EslintPresets } from '#cli/types/generation/eslint.ts';
import { eslintPresetSchema } from '#cli/schemas/configurations/manifest.ts';

export const eslintPresetsSchema = z.record(z.string(), eslintPresetSchema) satisfies z.ZodType<EslintPresets>;
