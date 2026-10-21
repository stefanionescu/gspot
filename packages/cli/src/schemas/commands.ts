import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { InitFormatOptions, RuffFormatSettings } from '#cli/types/commands/init.ts';

const fileFormatSchema = z.object({
    tabWidth: z.number().optional(),
    printWidth: z.number().optional(),
    singleQuote: z.boolean().optional(),
} satisfies SchemaShape<Omit<InitFormatOptions, 'overrides'>>);

export const formatOptionsSchema = fileFormatSchema.extend({
    overrides: z
        .array(
            z.object({
                files: z.union([z.string(), z.array(z.string())]),
                options: fileFormatSchema,
            } satisfies SchemaShape<NonNullable<InitFormatOptions['overrides']>[number]>),
        )
        .optional(),
}) satisfies z.ZodType<InitFormatOptions>;

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
