import { z } from 'zod';

import { CONFIGURATION_ORIGINS } from '#cli/config/repository/files.ts';
import { levelSchema } from '#cli/schemas/manifests/fields.ts';
import { configTableSchema } from '#cli/schemas/parsers.ts';
import { lintCommandSchema } from '#cli/schemas/repository.ts';
import { formatSchema } from '#cli/schemas/settings/fields.ts';

/**
Read the options of a config that init replaces. An option that gspot does not know, or a value that gspot.toml cannot
hold, goes to `dropped`, so a config of the user reaches the table and stops nothing.
*/
function buildCarriedSchema<Shape extends z.ZodRawShape>(shape: Shape) {
    const carriedSchema = z.object(shape).partial();
    return configTableSchema.transform((table) => {
        const groups = Map.groupBy(
            Object.entries(table),
            ([key, value]) => Object.hasOwn(shape, key) && (shape[key] as z.ZodType).safeParse(value).success,
        );
        return {
            ...carriedSchema.parse(Object.fromEntries(groups.get(true) ?? [])),
            dropped: (groups.get(false) ?? []).map(([key]) => key),
        };
    });
}

const { shape: format } = formatSchema;

const prettierFields = {
    tabWidth: format.indent_width.unwrap(),
    printWidth: format.print_width.unwrap(),
    singleQuote: z.boolean(),
    useTabs: z.boolean(),
    semi: format.semicolons.unwrap(),
    trailingComma: format.trailing_commas.unwrap(),
    bracketSpacing: format.bracket_spacing.unwrap(),
    arrowParens: format.arrow_parens.unwrap(),
    proseWrap: format.prose_wrap.unwrap(),
};

export const prettierOptionsSchema = buildCarriedSchema(prettierFields);

const overridesSchema = z.object({
    files: z.union([z.string(), z.string().array()]),
    excludeFiles: z.unknown().optional(),
    options: prettierOptionsSchema,
});

export const prettierSettingsSchema = buildCarriedSchema({ ...prettierFields, overrides: overridesSchema.array() });

const ruffRuleFields = {
    select: z.string().array(),
    'extend-select': z.string().array(),
    ignore: z.string().array(),
    'extend-ignore': z.string().array(),
    'per-file-ignores': z.record(z.string(), z.string().array()),
    'extend-per-file-ignores': z.record(z.string(), z.string().array()),
};

export const ruffOptionsSchema = buildCarriedSchema({
    ...ruffRuleFields,
    'line-length': format.print_width.unwrap(),
    'indent-width': format.indent_width.unwrap(),
    exclude: z.string().array(),
    'extend-exclude': z.string().array(),
    lint: buildCarriedSchema(ruffRuleFields),
    format: buildCarriedSchema({
        'quote-style': format.quotes,
        'indent-style': format.indent_style.unwrap(),
    }),
});

export const printedRulesSchema = z.looseObject({ rules: z.record(z.string(), z.unknown()) });

export const ruffProjectSchema = z.looseObject({
    tool: z.looseObject({ ruff: ruffOptionsSchema.optional() }).optional(),
});

export const pyrightScopeSchema = z.looseObject({
    include: z.string().array().default([]),
    exclude: z.string().array().default([]),
    typeCheckingMode: z.string().optional(),
});

export const pyrightProjectSchema = z.looseObject({
    tool: z
        .looseObject({ basedpyright: pyrightScopeSchema.optional(), pyright: pyrightScopeSchema.optional() })
        .optional(),
});

export const generatedFilesSchema = z.strictObject({
    written: z.string().array(),
    unchanged: z.string().array(),
    deleted: z.string().array(),
    updated: z.string().array(),
    notes: z.string().array(),
});

export const initFileRowSchema = z.strictObject({ path: z.string(), note: z.string() });

export const carryoverRowSchema = z.strictObject({
    path: z.string(),
    tool: z.string(),
    covered: z.int(),
    carried: z.string().array().readonly(),
    differing: z.string().array().readonly(),
    reasons: z.string().array().readonly(),
    plugins: z.string().array().readonly(),
    commandChecks: z.string().array().readonly(),
    dropped: z.string().array().readonly(),
});

export const leftOutSettingSchema = z.strictObject({ key: z.string(), note: z.string() });

export const initPlanSchema = z.strictObject({
    from: z.strictObject({ file: z.string(), leftOutSettings: leftOutSettingSchema.array() }).optional(),
    level: levelSchema,
    configurations: z
        .strictObject({
            configuration: z.string(),
            origin: z.enum(CONFIGURATION_ORIGINS),
            scopes: z.string().array(),
            checks: z.int(),
            checksOff: z.int(),
        })
        .array(),
    write: initFileRowSchema.array(),
    deleted: initFileRowSchema.array(),
    keep: initFileRowSchema.array(),
    change: initFileRowSchema.array(),
    lintFolders: initFileRowSchema.array(),
    lintCommands: lintCommandSchema.array(),
    carryover: carryoverRowSchema.array(),
});
