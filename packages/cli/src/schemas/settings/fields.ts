import { z } from 'zod';
import { LocalDate } from '@decimalturn/toml-patch';
import { MAX_PERCENTAGE } from '#cli/config/units.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { CASE_NAMES } from '#cli/config/configurations/naming.ts';
import { nonemptyStringSchema } from '#cli/schemas/configurations/fields.ts';
import type { WrittenFormat, TableSettings } from '#cli/types/settings/file.ts';
import type { SettingValue, ReasonedValue } from '#cli/types/settings/values.ts';
import type { ReasonedSettingDefinition } from '#cli/types/settings/definitions.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import type { NamingCase, NamingFields, ParsedNamingFields } from '#cli/types/settings/naming.ts';

import {
    INDENT_MAX,
    QUOTE_STYLES,
    LINE_ENDINGS,
    TRAILING_COMMAS,
    PRINT_WIDTH_MAX,
    PRINT_WIDTH_MIN,
    REASON_DESCRIPTIONS,
    FORMAT_INDENT_STYLES,
    RELATIVE_PATH_PATTERN,
    FORMAT_OVERRIDE_MIN_FIELDS,
} from '#cli/config/settings/fields.ts';

export const nonemptyStringsSchema = nonemptyStringSchema.array() satisfies z.ZodType<string[]>;

export const nonnegativeIntegerSchema = z.number().int().nonnegative() satisfies z.ZodType<number>;

export const percentageSchema = z.number().min(0).max(MAX_PERCENTAGE) satisfies z.ZodType<number>;

const formatFieldsSchema = z.strictObject({
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

export const relativePathSchema = z
    .string()
    .min(1)
    .regex(
        RELATIVE_PATH_PATTERN,
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    )
    .refine((path) => {
        const relative = path.startsWith('!') ? path.slice(1) : path;
        return !relative.startsWith('/') && !relative.split('/').includes('..');
    }, 'Use a relative path with forward slashes, without parent traversal or a drive prefix.')
    .meta({ path_role: 'source' }) satisfies z.ZodType<string>;

export const destinationPathSchema = relativePathSchema.meta({ path_role: 'destination' }) satisfies z.ZodType<string>;

const relativePathsSchema = relativePathSchema.array() satisfies z.ZodType<string[]>;

export const nonemptyPathsSchema = relativePathsSchema.min(1) satisfies z.ZodType<string[]>;

export const namingCategorySchema = z.strictObject({
    max_characters: allowReasonedValue(z.number().int().positive(), SETTING_DEFINITIONS['naming.max_characters']),
    max_words: allowReasonedValue(z.number().int().positive(), SETTING_DEFINITIONS['naming.max_words']),
    cases: allowReasonedValue(z.enum(CASE_NAMES).array(), SETTING_DEFINITIONS['naming.cases']),
} satisfies SchemaShape<ParsedNamingFields, NamingFields<SettingValue<number>, SettingValue<NamingCase[]>>>);

namingCategorySchema.register(z.globalRegistry, { id: 'namingCategory' });

export const calendarDateSchema = z.iso.date() satisfies z.ZodType<string>;

export const localDateSchema = z.custom<LocalDate>(
    (value) => value instanceof LocalDate && calendarDateSchema.safeParse(value.toISOString()).success,
    { error: 'Use an unquoted TOML local date in YYYY-MM-DD form, without a time or offset.' },
) satisfies z.ZodType<LocalDate>;

const formatOverrideSchema = z
    .strictObject({
        paths: nonemptyPathsSchema.meta(SETTING_DEFINITIONS['format.override.paths']),
        indent_style: formatFieldsSchema.shape.indent_style
            .unwrap()
            .describe(formatFieldsSchema.shape.indent_style.description as string),
        indent_width: formatFieldsSchema.shape.indent_width
            .unwrap()
            .describe(formatFieldsSchema.shape.indent_width.description as string),
        print_width: formatFieldsSchema.shape.print_width
            .unwrap()
            .describe(formatFieldsSchema.shape.print_width.description as string),
        line_ending: formatFieldsSchema.shape.line_ending
            .unwrap()
            .describe(formatFieldsSchema.shape.line_ending.description as string),
        final_newline: formatFieldsSchema.shape.final_newline
            .unwrap()
            .describe(formatFieldsSchema.shape.final_newline.description as string),
        quotes: formatFieldsSchema.shape.quotes.describe(formatFieldsSchema.shape.quotes.description as string),
        trailing_commas: formatFieldsSchema.shape.trailing_commas
            .unwrap()
            .describe(formatFieldsSchema.shape.trailing_commas.description as string),
        semicolons: formatFieldsSchema.shape.semicolons
            .unwrap()
            .describe(formatFieldsSchema.shape.semicolons.description as string),
    } satisfies SchemaShape<
        TableSettings<'format'>['override'][number],
        NonNullable<WrittenFormat['override']>[number]
    >)
    .refine((override) => Object.keys(override).length > 1, {
        message: 'A format override needs at least one formatting option.',
    })
    .meta({ minProperties: FORMAT_OVERRIDE_MIN_FIELDS });

export const formatSchema = formatFieldsSchema.extend({
    override: formatOverrideSchema
        .array()
        .default(SETTING_DEFINITIONS['format.override'].default)
        .meta(SETTING_DEFINITIONS['format.override']),
} satisfies SchemaShape<Pick<TableSettings<'format'>, 'override'>, Pick<WrittenFormat, 'override'>>);

/**
Accept a setting value, or a reasoned value with the same value schema.

@param schema the value validator.
@param definition the description of the setting and the change that needs a reason.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlining repeats the reasoned-value schema and exceeds file length and duplication limits.
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
                    reason: z.string().describe(REASON_DESCRIPTIONS[definition.reason_when]),
                })
                .transform((reasoned) => reasoned.value) satisfies z.ZodType<Output, ReasonedValue<Input>>,
        ])
        .default(definition.default)
        .meta(definition);
}
