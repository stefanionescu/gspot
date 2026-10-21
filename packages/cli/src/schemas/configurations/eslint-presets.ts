import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { EslintPresets } from '#cli/types/generation/eslint.ts';

/** JSON fields that a preset contributes to rule applicability and settings. */
const eslintPresetBlockSchema = z.strictObject({
    files: z.array(z.union([z.string(), z.array(z.string())])).exactOptional(),
    ignores: z.array(z.string()).exactOptional(),
    basePath: z.string().exactOptional(),
    parser: z.boolean(),
    rules: z.record(z.string(), z.json()).exactOptional(),
} satisfies SchemaShape<EslintPresets[string]['blocks'][number]>);

/** A preset copy names its exact installed package and the preset export. */
export const eslintPresetSchema = z.strictObject({
    package: z.string(),
    version: z.string(),
    source: z.string(),
    blocks: z.tuple([eslintPresetBlockSchema], eslintPresetBlockSchema),
} satisfies SchemaShape<EslintPresets[string]>);
