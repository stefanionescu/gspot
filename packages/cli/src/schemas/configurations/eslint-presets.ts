import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { EslintPresets } from '#cli/types/generation/eslint.ts';

const eslintPresetBlockSchema = z.strictObject({
    files: z.union([z.string(), z.string().array()]).array().exactOptional(),
    ignores: z.string().array().exactOptional(),
    basePath: z.string().exactOptional(),
    parser: z.boolean(),
    rules: z.record(z.string(), z.json()).exactOptional(),
} satisfies SchemaShape<EslintPresets[string]['blocks'][number]>);

export const eslintPresetSchema = z.strictObject({
    package: z.string(),
    version: z.string(),
    source: z.string(),
    blocks: z.tuple([eslintPresetBlockSchema], eslintPresetBlockSchema),
} satisfies SchemaShape<EslintPresets[string]>);

export const eslintPresetsSchema = z.record(z.string(), eslintPresetSchema) satisfies z.ZodType<EslintPresets>;
