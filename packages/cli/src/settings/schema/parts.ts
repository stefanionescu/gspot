import { z } from 'zod';
import { LocalDate } from '@decimalturn/toml-patch';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { CASE_NAMES } from '#cli/config/checks/general/naming.ts';
import type { ScopeSettings } from '#cli/types/settings/values.ts';
import { SETTING_DEFAULTS } from '#cli/config/settings/defaults.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import type { ReasonedSettingMetadata } from '#cli/types/settings/metadata.ts';
import type { SettingValue, WrittenFormat, ReasonedValue } from '#cli/types/settings/file.ts';
import type { NamingCase, NamingFields, TableSettings, ParsedNamingFields } from '#cli/types/settings/tables.ts';

import {
    INDENT_MAX,
    LINE_ENDINGS,
    QUOTE_STYLES,
    PRINT_WIDTH_MAX,
    PRINT_WIDTH_MIN,
    TRAILING_COMMAS,
    REASON_DESCRIPTIONS,
    FORMAT_INDENT_STYLES,
} from '#cli/config/settings/schema.ts';

const nonemptyString = z.string().min(1);
const nonemptyStrings = z.array(nonemptyString);

const wholeNumber = z.number().int().nonnegative();
const percentage = z.number().min(0).max(SETTING_DEFAULTS.percentage_maximum);

const formatFields = z.strictObject({
    indent_style: z
        .enum(FORMAT_INDENT_STYLES)
        .optional()
        .default('space')
        .meta(SETTING_DECLARATIONS['format.indent_style']),
    indent_width: z
        .number()
        .int()
        .min(1)
        .max(INDENT_MAX)
        .optional()
        .default(SETTING_DEFAULTS.indent_width)
        .meta(SETTING_DECLARATIONS['format.indent_width']),
    print_width: z
        .number()
        .int()
        .min(PRINT_WIDTH_MIN)
        .max(PRINT_WIDTH_MAX)
        .optional()
        .default(SETTING_DEFAULTS.print_width)
        .meta(SETTING_DECLARATIONS['format.print_width']),
    line_ending: z.enum(LINE_ENDINGS).optional().default('lf').meta(SETTING_DECLARATIONS['format.line_ending']),
    final_newline: z.boolean().optional().default(true).meta(SETTING_DECLARATIONS['format.final_newline']),
    quotes: z.enum(QUOTE_STYLES).optional().default('single').meta(SETTING_DECLARATIONS['format.quotes']),
    trailing_commas: z
        .enum(TRAILING_COMMAS)
        .optional()
        .default('all')
        .meta(SETTING_DECLARATIONS['format.trailing_commas']),
    semicolons: z.boolean().optional().default(true).meta(SETTING_DECLARATIONS['format.semicolons']),
} satisfies SchemaShape<Omit<TableSettings<'format'>, 'override'>, Omit<WrittenFormat, 'override'>>);

const relativePath = z
    .string()
    .min(1)
    .regex(
        /^(?!!?\/)(?![\s\S]*(?:^!?|\/)\.\.(?:\/|$))[^\\:\p{Cc}]+$/u,
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    )
    .meta({ pathRole: 'source' });

const destinationPath = relativePath.meta({ pathRole: 'destination' });
const relativePaths = z.array(relativePath);
const nonemptyPaths = relativePaths.min(1);

const namingCategorySchema = z.strictObject({
    max_characters: allowReasonedValue(
        z.number().int().positive(),
        SETTING_DEFAULTS.max_characters,
        SETTING_DECLARATIONS['naming.max_characters'],
    ),
    max_words: allowReasonedValue(
        z.number().int().positive(),
        SETTING_DEFAULTS.max_words,
        SETTING_DECLARATIONS['naming.max_words'],
    ),
    cases: allowReasonedValue(z.array(z.enum(CASE_NAMES)), [], SETTING_DECLARATIONS['naming.cases']),
} satisfies SchemaShape<ParsedNamingFields, NamingFields<SettingValue<number>, SettingValue<NamingCase[]>>>);

namingCategorySchema.register(z.globalRegistry, { id: 'namingCategory' });

/** Numeric limits at both written and resolved settings boundaries. */
const limitTableSchema = z.record(z.string(), z.number()) satisfies z.ZodType<ScopeSettings['limits']>;

/** The calendar form of CLI date arguments and of the editor JSON. */
const calendarDateSchema = z.iso.date();

/** Runtime expiry values keep unquoted TOML local dates. */
const localDateSchema = z.custom<LocalDate>(
    (value) => value instanceof LocalDate && calendarDateSchema.safeParse(value.toISOString()).success,
    { error: 'Use an unquoted TOML local date in YYYY-MM-DD form, without a time or offset.' },
);

const formatSchema = formatFields.extend({
    override: z
        .array(
            z
                .strictObject({
                    paths: nonemptyPaths.describe(SETTING_DECLARATIONS['format.override.paths'].description),
                    indent_style: formatFields.shape.indent_style
                        .unwrap()
                        .describe(formatFields.shape.indent_style.description as string),
                    indent_width: formatFields.shape.indent_width
                        .unwrap()
                        .describe(formatFields.shape.indent_width.description as string),
                    print_width: formatFields.shape.print_width
                        .unwrap()
                        .describe(formatFields.shape.print_width.description as string),
                    line_ending: formatFields.shape.line_ending
                        .unwrap()
                        .describe(formatFields.shape.line_ending.description as string),
                    final_newline: formatFields.shape.final_newline
                        .unwrap()
                        .describe(formatFields.shape.final_newline.description as string),
                    quotes: formatFields.shape.quotes
                        .unwrap()
                        .describe(formatFields.shape.quotes.description as string),
                    trailing_commas: formatFields.shape.trailing_commas
                        .unwrap()
                        .describe(formatFields.shape.trailing_commas.description as string),
                    semicolons: formatFields.shape.semicolons
                        .unwrap()
                        .describe(formatFields.shape.semicolons.description as string),
                } satisfies SchemaShape<
                    TableSettings<'format'>['override'][number],
                    NonNullable<WrittenFormat['override']>[number]
                >)
                .refine((entry) => Object.keys(entry).length > 1, {
                    message: 'A format override needs at least one formatting option.',
                })
                .meta({ minProperties: SETTING_DEFAULTS.minProperties }),
        )
        .default([])
        .meta(SETTING_DECLARATIONS['format.override']),
} satisfies SchemaShape<Pick<TableSettings<'format'>, 'override'>, Pick<WrittenFormat, 'override'>>);

/**
 * Accept a setting value, or a reasoned value with the same value schema.
 * @param schema the value validator.
 * @param defaultValue the value of an absent key.
 * @param metadata the description of the setting and the change that needs a reason.
 * @returns the setting schema with its default and metadata.
 */
function allowReasonedValue<Output, Input>(
    schema: z.ZodType<Output, Input>,
    defaultValue: z.util.NoUndefined<Output>,
    metadata: ReasonedSettingMetadata & Record<string, unknown>,
): z.ZodDefault<z.ZodUnion<readonly [z.ZodType<Output, Input>, z.ZodType<Output, ReasonedValue<Input>>]>> {
    return z
        .union([schema, buildReasonedValueSchema(schema, metadata)])
        .default(defaultValue)
        .meta(metadata);
}

/**
 * Read one value with its required reason.
 * @param schema the validator of the value.
 * @param metadata the description of the setting and the change that needs a reason.
 * @returns the value read from its strict reasoned value.
 */
function buildReasonedValueSchema<Output, Input>(
    schema: z.ZodType<Output, Input>,
    metadata: ReasonedSettingMetadata,
): z.ZodType<Output, ReasonedValue<Input>> {
    return z
        .strictObject({
            value: schema.describe(metadata.description),
            reason: z.string().describe(REASON_DESCRIPTIONS[metadata.reason_needed]),
        } satisfies SchemaShape<ReasonedValue<Output>, ReasonedValue<Input>>)
        .transform((entry) => entry.value) satisfies z.ZodType<Output, ReasonedValue<Input>>;
}

/**
 * Remove optional and default wrappers to inspect the shape of a setting.
 * @param schema the validator to inspect.
 * @returns the inner validator.
 */
function unwrapSettingSchema(schema: z.ZodType): z.ZodType {
    let inner = schema;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault || inner instanceof z.ZodPrefault)
        inner = inner.unwrap() as z.ZodType;
    return inner;
}

export {
    percentage,
    wholeNumber,
    relativePath,
    formatSchema,
    nonemptyPaths,
    relativePaths,
    nonemptyString,
    localDateSchema,
    nonemptyStrings,
    destinationPath,
    limitTableSchema,
    calendarDateSchema,
    allowReasonedValue,
    unwrapSettingSchema,
    namingCategorySchema,
    buildReasonedValueSchema,
};
