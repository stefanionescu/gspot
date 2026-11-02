import { z } from 'zod';
import { PROSE_WRAPS, ARROW_PARENS, TRAILING_COMMAS } from '#cli/config/settings/schema.ts';

const prettierOptionsSchema = z.object({
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

export const ruffOptionsSchema = z.looseObject({
    'line-length': z.number().optional(),
    'indent-width': z.number().optional(),
    format: z
        .looseObject({
            'quote-style': z.string().optional(),
            'indent-style': z.string().optional(),
        })
        .optional(),
});

export const ruffProjectSchema = z.looseObject({
    tool: z.looseObject({ ruff: ruffOptionsSchema.optional() }).optional(),
});
