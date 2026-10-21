import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { PrettierOptions, RuffFormatSettings } from '#cli/types/commands/init.ts';

const prettierOptionsSchema = z.object({
    tabWidth: z.number().optional(),
    printWidth: z.number().optional(),
    singleQuote: z.boolean().optional(),
} satisfies SchemaShape<Omit<PrettierOptions, 'overrides'>>);

export const prettierSettingsSchema = prettierOptionsSchema.extend({
    overrides: z
        .array(
            z.object({
                files: z.union([z.string(), z.array(z.string())]),
                options: prettierOptionsSchema,
            } satisfies SchemaShape<NonNullable<PrettierOptions['overrides']>[number]>),
        )
        .optional(),
}) satisfies z.ZodType<PrettierOptions>;

export const ruffFormatSchema = z.looseObject({
    format: z.looseObject({ 'quote-style': z.string().optional() }).optional(),
    tool: z
        .looseObject({
            ruff: z
                .looseObject({ format: z.looseObject({ 'quote-style': z.string().optional() }).optional() })
                .optional(),
        })
        .optional(),
}) satisfies z.ZodType<RuffFormatSettings>;
