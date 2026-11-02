import { z } from 'zod';
import { PROSE_WRAPS, ARROW_PARENS, TRAILING_COMMAS } from '#cli/config/settings/schema.ts';

const prettierOptionsSchema = z.looseObject({
    tabWidth: z.number().optional(),
    printWidth: z.number().optional(),
    singleQuote: z.boolean().optional(),
    useTabs: z.boolean().optional(),
    semi: z.boolean().optional(),
    trailingComma: z.enum(TRAILING_COMMAS).optional(),
    bracketSpacing: z.boolean().optional(),
    arrowParens: z.enum(ARROW_PARENS).optional(),
    proseWrap: z.enum(PROSE_WRAPS).optional(),
});
const overridesSchema = z.object({
    files: z.union([z.string(), z.string().array()]),
    options: prettierOptionsSchema,
});

export const prettierSettingsSchema = prettierOptionsSchema.extend({
    overrides: overridesSchema.array().optional(),
});

const ruffRuleFields = {
    select: z.string().array().optional(),
    'extend-select': z.string().array().optional(),
    ignore: z.string().array().optional(),
    'extend-ignore': z.string().array().optional(),
    'per-file-ignores': z.record(z.string(), z.string().array()).optional(),
};

export const ruffOptionsSchema = z.looseObject({
    ...ruffRuleFields,
    'line-length': z.number().optional(),
    'indent-width': z.number().optional(),
    exclude: z.string().array().optional(),
    'extend-exclude': z.string().array().optional(),
    lint: z.looseObject(ruffRuleFields).optional(),
    format: z
        .looseObject({
            'quote-style': z.string().optional(),
            'indent-style': z.string().optional(),
        })
        .optional(),
});

export const printedRulesSchema = z.looseObject({ rules: z.record(z.string(), z.unknown()) });

export const ruffProjectSchema = z.looseObject({
    tool: z.looseObject({ ruff: ruffOptionsSchema.optional() }).optional(),
});
