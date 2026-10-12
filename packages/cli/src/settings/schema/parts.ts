import { z } from 'zod';
import { LocalDate } from '@decimalturn/toml-patch';
import type { SchemaShape } from '#cli/types/objects.ts';
import { TABLE_FIELDS } from '#cli/config/settings/values.ts';
import { CASE_NAMES } from '#cli/config/checks/general/naming.ts';
import type { ScopeSettings } from '#cli/types/settings/values.ts';
import { DEFAULT_VALUES, RECORD_DESCRIPTIONS } from '#cli/config/settings/defaults.ts';
import type { ReasonValue, WrittenFormat, ReasonEnvelope } from '#cli/types/settings/file.ts';
import type { NamingCase, NamingFields, TableSettings, ParsedNamingFields } from '#cli/types/settings/tables.ts';

import {
    INDENT_MAX,
    LINE_ENDINGS,
    QUOTE_STYLES,
    SETTING_FIELDS,
    PRINT_WIDTH_MAX,
    PRINT_WIDTH_MIN,
    TRAILING_COMMAS,
    FORMAT_INDENT_STYLES,
} from '#cli/config/settings/schema.ts';

const nonemptyString = z.string().min(1);
const nonemptyStrings = z.array(nonemptyString);

const wholeNumber = z.number().int().nonnegative();
const percentage = z.number().min(0).max(DEFAULT_VALUES.percentage_maximum);

const formatFields = z.strictObject({
    indent_style: settingField(z.enum(FORMAT_INDENT_STYLES).optional(), 'space', TABLE_FIELDS.indent_style),
    indent_width: settingField(
        z.number().int().min(1).max(INDENT_MAX).optional(),
        DEFAULT_VALUES.indent_width,
        TABLE_FIELDS.indent_width,
    ),
    print_width: settingField(
        z.number().int().min(PRINT_WIDTH_MIN).max(PRINT_WIDTH_MAX).optional(),
        DEFAULT_VALUES.print_width,
        TABLE_FIELDS.print_width,
    ),
    line_ending: settingField(z.enum(LINE_ENDINGS).optional(), 'lf', TABLE_FIELDS.line_ending),
    final_newline: settingField(z.boolean().optional(), true, TABLE_FIELDS.final_newline),
    quotes: settingField(z.enum(QUOTE_STYLES).optional(), 'single', TABLE_FIELDS.quotes),
    trailing_commas: settingField(z.enum(TRAILING_COMMAS).optional(), 'all', TABLE_FIELDS.trailing_commas),
    semicolons: settingField(z.boolean().optional(), true, TABLE_FIELDS.semicolons),
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
    max_characters: settingField(
        reasonValue(z.number().int().positive()),
        DEFAULT_VALUES.max_characters,
        SETTING_FIELDS.max_characters,
    ),
    max_words: settingField(
        reasonValue(z.number().int().positive()),
        DEFAULT_VALUES.max_words,
        SETTING_FIELDS.max_words,
    ),
    cases: settingField(reasonValue(z.array(z.enum(CASE_NAMES))), [], SETTING_FIELDS.cases),
} satisfies SchemaShape<ParsedNamingFields, NamingFields<ReasonValue<number>, ReasonValue<NamingCase[]>>>);

/** Numeric limits at both written and resolved settings boundaries. */
const limitTableSchema = z.record(z.string(), z.number()) satisfies z.ZodType<ScopeSettings['limits']>;

/** The calendar form used by CLI date arguments and the editor's JSON representation. */
const calendarDateSchema = z.iso.date();

/** Runtime expiry values retain unquoted TOML local dates. */
const localDateSchema = z.custom<LocalDate>(
    (value) => value instanceof LocalDate && calendarDateSchema.safeParse(value.toISOString()).success,
    { error: 'Use an unquoted TOML local date in YYYY-MM-DD form, without a time or offset.' },
);

/**
 * Publish settings input schemas while retaining written defaults and declaration metadata.
 * @param schema the authoritative runtime validator.
 * @returns its object projection, with TOML dates represented as calendar strings.
 */
function settingsJsonSchema(schema: z.ZodType): z.core.JSONSchema.JSONSchema {
    return z.toJSONSchema(schema, {
        io: 'input',
        unrepresentable: ({ zodSchema }) =>
            zodSchema === localDateSchema ? z.toJSONSchema(calendarDateSchema) : 'throw',
        override: ({ zodSchema, jsonSchema }) => {
            const metadata = z.globalRegistry.get(zodSchema);
            if (metadata && Object.hasOwn(metadata, 'examples'))
                Object.assign(jsonSchema, { examples: metadata['examples'] });
        },
    });
}

const formatSchema = formatFields.extend({
    override: settingField(
        z.array(
            z
                .strictObject({
                    paths: nonemptyPaths.describe(RECORD_DESCRIPTIONS.format_paths),
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
                .meta({ minProperties: DEFAULT_VALUES.minProperties }),
        ),
        [],
        TABLE_FIELDS.formatschema_override,
    ),
} satisfies SchemaShape<Pick<TableSettings<'format'>, 'override'>, Pick<WrittenFormat, 'override'>>);

/**
 * Apply a setting's default and declaration to its explicit validator.
 * @param schema the field's validator
 * @param value the default used when the document omits the field
 * @param metadata the field's declaration
 * @returns the declared field with its default
 */
function settingField<Schema extends z.ZodType>(
    schema: Schema,
    value: z.core.util.NoUndefined<z.output<Schema>>,
    metadata: z.GlobalMeta,
): z.ZodDefault<Schema> {
    return schema.default(value).meta(metadata);
}

/**
 * Accept a setting value with its explanation in the same TOML entry.
 * @param schema the setting's value schema
 * @returns the value schema and its reason form
 */
function reasonValue<Output, Input>(
    schema: z.ZodType<Output, Input>,
): z.ZodType<Output, Input | ReasonEnvelope<Input>> {
    const value = z.union([schema, reasonEnvelopeSchema(schema.describe('The setting value.'))]);
    const metadata = schema.meta();
    return metadata === undefined ? value : value.meta(metadata);
}

/**
 * Read one value together with its required explanation.
 * @param schema the field's value validator and description
 * @returns the value read from its strict reason envelope
 */
function reasonEnvelopeSchema<Output, Input>(
    schema: z.ZodType<Output, Input>,
): z.ZodType<Output, ReasonEnvelope<Input>> {
    return z
        .strictObject({
            value: schema,
            reason: z.string().describe('Why this value is needed.'),
        } satisfies SchemaShape<ReasonEnvelope<Output>, ReasonEnvelope<Input>>)
        .transform((entry) => entry.value) satisfies z.ZodType<Output, ReasonEnvelope<Input>>;
}

/**
 * Remove optional and default wrappers before inspecting a setting's shape.
 * @param schema the validator to inspect
 * @returns the validator that defines the setting's value
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
    reasonValue,
    relativePath,
    formatSchema,
    settingField,
    relativePaths,
    nonemptyPaths,
    nonemptyString,
    nonemptyStrings,
    destinationPath,
    localDateSchema,
    limitTableSchema,
    calendarDateSchema,
    settingsJsonSchema,
    unwrapSettingSchema,
    namingCategorySchema,
    reasonEnvelopeSchema,
};
