import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { TRAILING_COMMAS } from '#cli/config/settings/fields.ts';
import type { PrettierOptions, RuffFormatSettings } from '#cli/types/commands/init.ts';

const prettierOptionsSchema = z.object({
    tabWidth: z.number().optional(),
    printWidth: z.number().optional(),
    singleQuote: z.boolean().optional(),
    useTabs: z.boolean().optional(),
    semi: z.boolean().optional(),
    trailingComma: z.enum(TRAILING_COMMAS).optional(),
} satisfies SchemaShape<Omit<PrettierOptions, 'overrides'>>);
const overridesSchema = z.object({
    files: z.union([z.string(), z.string().array()]),
    options: prettierOptionsSchema,
} satisfies SchemaShape<NonNullable<PrettierOptions['overrides']>[number]>);

export const prettierSettingsSchema = prettierOptionsSchema.extend({
    overrides: overridesSchema.array().optional(),
}) satisfies z.ZodType<PrettierOptions>;

const ruffQuotesSchema = z.looseObject({ 'quote-style': z.string().optional() } satisfies SchemaShape<
    NonNullable<RuffFormatSettings['format']>
>);
const ruffOptionsSchema = z.looseObject({ format: ruffQuotesSchema.optional() }) satisfies z.ZodType<
    NonNullable<NonNullable<RuffFormatSettings['tool']>['ruff']>
>;

export const ruffFormatSchema = z.looseObject({
    format: ruffQuotesSchema.optional(),
    tool: z
        .looseObject({
            ruff: ruffOptionsSchema.optional(),
        })
        .optional(),
}) satisfies z.ZodType<RuffFormatSettings>;
