import { z } from 'zod';
import { TRAILING_COMMAS } from '#cli/config/settings/fields.ts';

const prettierOptionsSchema = z.object({
    tabWidth: z.number().optional(),
    printWidth: z.number().optional(),
    singleQuote: z.boolean().optional(),
    useTabs: z.boolean().optional(),
    semi: z.boolean().optional(),
    trailingComma: z.enum(TRAILING_COMMAS).optional(),
});
const overridesSchema = z.object({
    files: z.union([z.string(), z.string().array()]),
    options: prettierOptionsSchema,
});

export const prettierSettingsSchema = prettierOptionsSchema.extend({
    overrides: overridesSchema.array().optional(),
});

const ruffQuotesSchema = z.looseObject({ 'quote-style': z.string().optional() });
const ruffOptionsSchema = z.looseObject({ format: ruffQuotesSchema.optional() });

export const ruffFormatSchema = z.looseObject({
    format: ruffQuotesSchema.optional(),
    tool: z
        .looseObject({
            ruff: ruffOptionsSchema.optional(),
        })
        .optional(),
});

const lintRuleDocsSchema = z.looseObject({
    description: z.string().exactOptional(),
    url: z.string().exactOptional(),
});

export const ruleDocumentationSchema = z.looseObject({
    docs: lintRuleDocsSchema.exactOptional(),
    url: z.string().exactOptional(),
});
