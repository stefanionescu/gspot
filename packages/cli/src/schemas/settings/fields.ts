import { z } from 'zod';
import { LocalDate } from '@decimalturn/toml-patch';
import { MAX_PERCENTAGE } from '#cli/config/units.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { CASE_NAMES } from '#cli/config/configurations/naming.ts';
import { nonemptyString } from '#cli/schemas/configurations/fields.ts';
import type { ReasonedSettingDefinition } from '#cli/types/settings/definitions.ts';
import { type WrittenFormat, type TableSettings } from '#cli/types/settings/file.ts';
import { type SettingValue, type ReasonedValue } from '#cli/types/settings/values.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { type NamingCase, type NamingFields, type ParsedNamingFields } from '#cli/types/settings/naming.ts';

import {
    INDENT_MAX,
    QUOTE_STYLES,
    LINE_ENDINGS,
    TRAILING_COMMAS,
    PRINT_WIDTH_MAX,
    PRINT_WIDTH_MIN,
    REASON_DESCRIPTIONS,
    FORMAT_INDENT_STYLES,
    FORMAT_OVERRIDE_MIN_FIELDS,
} from '#cli/config/settings/fields.ts';

export const nonemptyStrings = z.array(nonemptyString);

export const nonnegativeInteger = z.number().int().nonnegative();
export const percentage = z.number().min(0).max(MAX_PERCENTAGE);

const formatFields = z.strictObject({
    indent_style: z
        .enum(FORMAT_INDENT_STYLES)
        .optional()
        .default(SETTING_DEFINITIONS['format.indent_style'].default)
        .meta(SETTING_DEFINITIONS['format.indent_style']),
    indent_width: z
        .number()
        .int()
        .min(1)
        .max(INDENT_MAX)
        .optional()
        .default(SETTING_DEFINITIONS['format.indent_width'].default)
        .meta(SETTING_DEFINITIONS['format.indent_width']),
    print_width: z
        .number()
        .int()
        .min(PRINT_WIDTH_MIN)
        .max(PRINT_WIDTH_MAX)
        .optional()
        .default(SETTING_DEFINITIONS['format.print_width'].default)
        .meta(SETTING_DEFINITIONS['format.print_width']),
    line_ending: z
        .enum(LINE_ENDINGS)
        .optional()
        .default(SETTING_DEFINITIONS['format.line_ending'].default)
        .meta(SETTING_DEFINITIONS['format.line_ending']),
    final_newline: z
        .boolean()
        .optional()
        .default(SETTING_DEFINITIONS['format.final_newline'].default)
        .meta(SETTING_DEFINITIONS['format.final_newline']),
    quotes: z.enum(QUOTE_STYLES).optional().meta(SETTING_DEFINITIONS['format.quotes']),
    trailing_commas: z
        .enum(TRAILING_COMMAS)
        .optional()
        .default(SETTING_DEFINITIONS['format.trailing_commas'].default)
        .meta(SETTING_DEFINITIONS['format.trailing_commas']),
    semicolons: z
        .boolean()
        .optional()
        .default(SETTING_DEFINITIONS['format.semicolons'].default)
        .meta(SETTING_DEFINITIONS['format.semicolons']),
} satisfies SchemaShape<Omit<TableSettings<'format'>, 'override'>, Omit<WrittenFormat, 'override'>>);

export const relativePath = z
    .string()
    .min(1)
    .regex(
        /^(?!!?\/)(?![\s\S]*(?:^!?|\/)\.\.(?:\/|$))(?:[^\\:\p{Cc}]|\\[()[\]{}*?!+@,])+$/u,
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    )
    .meta({ path_role: 'source' });

export const destinationPath = relativePath.meta({ path_role: 'destination' });
export const relativePaths = z.array(relativePath);
export const nonemptyPaths = relativePaths.min(1);

export const namingCategorySchema = z.strictObject({
    max_characters: allowReasonedValue(z.number().int().positive(), SETTING_DEFINITIONS['naming.max_characters']),
    max_words: allowReasonedValue(z.number().int().positive(), SETTING_DEFINITIONS['naming.max_words']),
    cases: allowReasonedValue(z.array(z.enum(CASE_NAMES)), SETTING_DEFINITIONS['naming.cases']),
} satisfies SchemaShape<ParsedNamingFields, NamingFields<SettingValue<number>, SettingValue<NamingCase[]>>>);

namingCategorySchema.register(z.globalRegistry, { id: 'namingCategory' });

export const calendarDateSchema = z.iso.date();

export const localDateSchema = z.custom<LocalDate>(
    (value) => value instanceof LocalDate && calendarDateSchema.safeParse(value.toISOString()).success,
    { error: 'Use an unquoted TOML local date in YYYY-MM-DD form, without a time or offset.' },
);

export const formatSchema = formatFields.extend({
    override: z
        .array(
            z
                .strictObject({
                    paths: nonemptyPaths.describe(SETTING_DEFINITIONS['format.override.paths'].description),
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
                    quotes: formatFields.shape.quotes.describe(formatFields.shape.quotes.description as string),
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
                .refine((override) => Object.keys(override).length > 1, {
                    message: 'A format override needs at least one formatting option.',
                })
                .meta({ minProperties: FORMAT_OVERRIDE_MIN_FIELDS }),
        )
        .default(SETTING_DEFINITIONS['format.override'].default)
        .meta(SETTING_DEFINITIONS['format.override']),
} satisfies SchemaShape<Pick<TableSettings<'format'>, 'override'>, Pick<WrittenFormat, 'override'>>);

/**
 * Accept a setting value, or a reasoned value with the same value schema.
 *
 * @param schema the value validator.
 * @param definition the description of the setting and the change that needs a reason.
 * @returns the setting schema with its default and definition.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 23 calls in 5 files share it.
export function allowReasonedValue<Output, Input>(
    schema: z.ZodType<Output, Input>,
    definition: ReasonedSettingDefinition & { default: z.util.NoUndefined<Output> },
): z.ZodDefault<z.ZodUnion<readonly [z.ZodType<Output, Input>, z.ZodType<Output, ReasonedValue<Input>>]>> {
    return z
        .union([
            schema,
            z
                .strictObject({
                    value: schema.describe(definition.description),
                    reason: z.string().describe(REASON_DESCRIPTIONS[definition.reason_needed]),
                })
                .transform((reasoned) => reasoned.value) satisfies z.ZodType<Output, ReasonedValue<Input>>,
        ])
        .default(definition.default)
        .meta(definition);
}

/**
 * Remove optional and default wrappers to inspect the shape of a setting.
 *
 * @param schema the validator to inspect.
 * @returns the inner validator.
 */
export function unwrapSettingSchema(schema: z.ZodType): z.ZodType {
    let inner = schema;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault || inner instanceof z.ZodPrefault)
        inner = inner.unwrap() as z.ZodType;
    return inner;
}
