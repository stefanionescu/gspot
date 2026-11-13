import { z } from 'zod';

import { CASE_NAMES } from '#cli/config/manifests.ts';
import {
    ARROW_PARENS,
    BOUND_REASON_DESCRIPTION,
    FORMAT_INDENT_STYLES,
    FORMAT_OVERRIDE_MIN_FIELDS,
    INDENT_DEFAULT,
    INDENT_MAX,
    MAX_PERCENTAGE,
    PRINT_WIDTH_DEFAULT,
    PRINT_WIDTH_MAX,
    PRINT_WIDTH_MIN,
    PROSE_WRAPS,
    QUOTE_STYLES,
    REASON_DESCRIPTIONS,
    RELATIVE_PATH_PATTERN,
    REMOVAL_REASON_DESCRIPTION,
    SETTING_ORIGIN_KINDS,
    TRAILING_COMMAS,
} from '#cli/config/settings/fields.ts';
import { NAMING_LANGUAGES } from '#cli/config/settings/tables.ts';
import { GLOB_EXCLUDE } from '#cli/config/system.ts';
import { nonemptyStringSchema } from '#cli/schemas/manifests/fields.ts';
import type { ReasonedValue } from '#cli/types/settings.ts';

export const nonemptyStringsSchema = nonemptyStringSchema.array();

export const configurationNameSchema = z.string().meta({ value_names: 'configurations' });

export const removedConfigurationsSchema = z
    .record(configurationNameSchema, z.string().describe(REMOVAL_REASON_DESCRIPTION))
    .transform((reasons) => Object.keys(reasons));

export const nonnegativeIntegerSchema = z.int().nonnegative();

export const percentageSchema = z.number().min(0).max(MAX_PERCENTAGE);

const formatFieldsSchema = z.strictObject({
    indent_style: z
        .enum(FORMAT_INDENT_STYLES)
        .default('space')
        .meta({
            configurations: ['format'],
            description: 'The character of one indent level.',
        }),
    indent_width: z
        .int()
        .min(1)
        .max(INDENT_MAX)
        .default(INDENT_DEFAULT)
        .meta({
            configurations: ['format'],
            description: 'Spaces per indent level.',
        }),
    print_width: z
        .int()
        .min(PRINT_WIDTH_MIN)
        .max(PRINT_WIDTH_MAX)
        .default(PRINT_WIDTH_DEFAULT)
        .meta({
            configurations: ['format'],
            description: 'The line width formatters wrap at.',
        }),
    quotes: z
        .enum(QUOTE_STYLES)
        .optional()
        .meta({
            configurations: ['format'],
            description:
                'The quote for the languages where a formatter chooses. When unset, Python gets double quotes and the other languages single.',
        }),
    trailing_commas: z
        .enum(TRAILING_COMMAS)
        .default('all')
        .meta({
            configurations: ['format'],
            description: 'Where trailing commas go.',
        }),
    semicolons: z
        .boolean()
        .default(true)
        .meta({
            configurations: ['format'],
            description: 'Whether JavaScript and TypeScript statements end with semicolons.',
        }),
    bracket_spacing: z
        .boolean()
        .default(true)
        .meta({
            configurations: ['format'],
            description: 'Whether Prettier prints spaces inside the braces of an object.',
        }),
    arrow_parens: z
        .enum(ARROW_PARENS)
        .default('always')
        .meta({
            configurations: ['format'],
            description: 'Whether Prettier keeps the parentheses around a single arrow function parameter.',
        }),
    prose_wrap: z
        .enum(PROSE_WRAPS)
        .default('preserve')
        .meta({
            configurations: ['format'],
            description: 'How Prettier wraps Markdown prose.',
        }),
});

export const relativePathSchema = z
    .string()
    .min(1)
    .regex(
        RELATIVE_PATH_PATTERN,
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    )
    .refine((path) => {
        const relative = path.startsWith(GLOB_EXCLUDE) ? path.slice(1) : path;
        return !relative.startsWith('/') && !relative.split('/').includes('..');
    }, 'Use a relative path with forward slashes, without parent traversal or a drive prefix.')
    .meta({ path_role: 'source' });

export const destinationPathSchema = relativePathSchema.meta({ path_role: 'destination' });

const relativePathsSchema = relativePathSchema.array();

export const nonemptyPathsSchema = relativePathsSchema.min(1);

export function allowReasonedValue<Output, Input>(
    schema: z.ZodType<Output, Input>,
    definition: z.GlobalMeta & { description: string; default: z.util.NoUndefined<Output> },
): z.ZodDefault<z.ZodUnion<readonly [z.ZodType<Output, Input>, z.ZodType<Output, ReasonedValue<Input>>]>> {
    return z
        .union([
            schema,
            z
                .strictObject({
                    value: schema.describe(definition.description),
                    reason: z
                        .string()
                        .describe(
                            definition.reason_for === undefined
                                ? BOUND_REASON_DESCRIPTION
                                : REASON_DESCRIPTIONS[definition.reason_for],
                        ),
                })
                .transform((reasoned) => reasoned.value),
        ])
        .default(definition.default)
        .meta({ ...definition, reasoned: true });
}

export const namingCategorySchema = z
    .strictObject({
        max_characters: allowReasonedValue(z.int().positive(), {
            configurations: ['naming'],
            description: 'The most characters one identifier may have.',
            languages: NAMING_LANGUAGES,
            language_defaults: { swift: 40, sql: 55 },
            default: 35,
        }),
        max_words: allowReasonedValue(z.int().positive(), {
            configurations: ['naming'],
            description: 'The most words one identifier may have.',
            languages: NAMING_LANGUAGES,
            language_defaults: { swift: 5, sql: 7 },
            default: 4,
        }),
        cases: allowReasonedValue(z.enum(CASE_NAMES).array(), {
            configurations: ['naming'],
            description:
                'The case patterns that one identifier category accepts: camel, pascal, kebab, snake, upper-snake, pascal-extension (String+Format.swift), or timestamp-snake (20260103120000_create_users.sql). Ruff checks the case of Python classes, functions, and parameters, and SwiftLint checks Swift types, variables, parameters, and enum cases; this setting covers the rest.',
            reason_for: 'adding',
            languages: NAMING_LANGUAGES,
            default: [],
        }),
    })
    .register(z.globalRegistry, { id: 'namingCategory' });

type FormatFields = typeof formatFieldsSchema.shape;

const formatOverrideFields = Object.fromEntries(
    Object.entries(formatFieldsSchema.shape).map(([name, field]) => [
        name,
        field
            .unwrap()
            .optional()
            .describe(field.description as string),
    ]),
) as { [Name in keyof FormatFields]: z.ZodOptional<ReturnType<FormatFields[Name]['unwrap']>> };

const formatOverrideSchema = z
    .strictObject({
        paths: nonemptyPathsSchema.meta({
            description: 'The files these formatting values apply to.',
        }),
        ...formatOverrideFields,
    })
    .refine((override) => Object.keys(override).length >= FORMAT_OVERRIDE_MIN_FIELDS, {
        error: 'A format override needs at least one formatting option.',
    })
    .meta({ minProperties: FORMAT_OVERRIDE_MIN_FIELDS });

export const formatSchema = formatFieldsSchema.extend({
    override: formatOverrideSchema
        .array()
        .default([])
        .meta({
            configurations: ['format'],
            description: 'Formatting options for repository-relative paths, in order.',
        }),
});

export const settingOriginSchema = z.strictObject({ kind: z.enum(SETTING_ORIGIN_KINDS), name: z.string() });

export const removedConfigurationSchema = z.strictObject({ name: z.string(), scope: z.string(), reason: z.string() });
