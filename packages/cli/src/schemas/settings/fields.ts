import { z } from 'zod';
import { nonemptyStringSchema } from '#cli/schemas/manifests/tools.ts';
import type { ReasonedValue, ReasonedSettingDefinition } from '#cli/types/settings.ts';
import { CASE_NAMES, SETTING_LANGUAGES, REASON_DESCRIPTIONS, BOUND_REASON_DESCRIPTION } from '#cli/config/manifests.ts';

import {
    INDENT_MAX,
    PROSE_WRAPS,
    ARROW_PARENS,
    QUOTE_STYLES,
    MAX_PERCENTAGE,
    PRINT_WIDTH_MIN,
    PRINT_WIDTH_MAX,
    TRAILING_COMMAS,
    FORMAT_INDENT_STYLES,
    RELATIVE_PATH_PATTERN,
    REMOVAL_REASON_DESCRIPTION,
    FORMAT_OVERRIDE_MIN_FIELDS,
} from '#cli/config/settings/schema.ts';

export const nonemptyStringsSchema = nonemptyStringSchema.array();

export const removedConfigurationsSchema = z
    .record(z.string(), z.string().describe(REMOVAL_REASON_DESCRIPTION))
    .transform((reasons) => Object.keys(reasons));

export const nonnegativeIntegerSchema = z.number().int().nonnegative();

export const percentageSchema = z.number().min(0).max(MAX_PERCENTAGE);

const formatFieldsSchema = z.strictObject({
    indent_style: z
        .enum(FORMAT_INDENT_STYLES)
        .optional()
        .default('space')
        .meta({
            configurations: ['format'],
            description: 'The character of one indent level: space or tab.',
        }),
    indent_width: z
        .number()
        .int()
        .min(1)
        .max(INDENT_MAX)
        .optional()
        .default(4)
        .meta({
            configurations: ['format'],
            description: 'Spaces per indent level.',
        }),
    print_width: z
        .number()
        .int()
        .min(PRINT_WIDTH_MIN)
        .max(PRINT_WIDTH_MAX)
        .optional()
        .default(120)
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
                'Single or double, for the languages where a formatter chooses. Unset, Python gets double quotes and the other languages single.',
        }),
    trailing_commas: z
        .enum(TRAILING_COMMAS)
        .optional()
        .default('all')
        .meta({
            configurations: ['format'],
            description: 'Where trailing commas go: all, es5, or none.',
        }),
    semicolons: z
        .boolean()
        .optional()
        .default(true)
        .meta({
            configurations: ['format'],
            description: 'Whether JavaScript and TypeScript statements end with semicolons.',
        }),
    bracket_spacing: z
        .boolean()
        .optional()
        .default(true)
        .meta({
            configurations: ['format'],
            description: 'Whether Prettier prints spaces inside the braces of an object.',
        }),
    arrow_parens: z
        .enum(ARROW_PARENS)
        .optional()
        .default('always')
        .meta({
            configurations: ['format'],
            description: 'Whether Prettier keeps the parentheses around a single arrow function parameter.',
        }),
    prose_wrap: z
        .enum(PROSE_WRAPS)
        .optional()
        .default('preserve')
        .meta({
            configurations: ['format'],
            description: 'How Prettier wraps Markdown prose: always, never, or preserve.',
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
        const relative = path.startsWith('!') ? path.slice(1) : path;
        return !relative.startsWith('/') && !relative.split('/').includes('..');
    }, 'Use a relative path with forward slashes, without parent traversal or a drive prefix.')
    .meta({ path_role: 'source' });

export const destinationPathSchema = relativePathSchema.meta({ path_role: 'destination' });

const relativePathsSchema = relativePathSchema.array();

export const nonemptyPathsSchema = relativePathsSchema.min(1);

/**
Accept a setting value, or a reasoned value with the same value schema.

@param schema the value validator.
@param definition the description of the setting and the change that needs a reason.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The settings schemas accept a reasoned value for each setting through this one schema.
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
                    reason: z
                        .string()
                        .describe(
                            definition.reason_when === undefined
                                ? BOUND_REASON_DESCRIPTION
                                : REASON_DESCRIPTIONS[definition.reason_when],
                        ),
                })
                .transform((reasoned) => reasoned.value),
        ])
        .default(definition.default)
        .meta({ ...definition, reasoned: true });
}

export const namingCategorySchema = z.strictObject({
    max_characters: allowReasonedValue(z.number().int().positive(), {
        configurations: ['naming'],
        description: 'The most characters one identifier may have.',
        languages: SETTING_LANGUAGES,
        language_defaults: { swift: 40, sql: 55 },
        default: 35,
    }),
    max_words: allowReasonedValue(z.number().int().positive(), {
        configurations: ['naming'],
        description: 'The most words one identifier may have.',
        languages: SETTING_LANGUAGES,
        language_defaults: { swift: 5, sql: 7 },
        default: 4,
    }),
    cases: allowReasonedValue(z.enum(CASE_NAMES).array(), {
        configurations: ['naming'],
        description:
            'The case patterns that one identifier category accepts: camel, pascal, kebab, snake, upper-snake, pascal-extension (String+Format.swift), or timestamp-snake (20260103120000_create_users.sql). Ruff checks the case of Python classes, functions, and parameters, and SwiftLint checks Swift types, variables, parameters, and enum cases; this setting covers the rest.',
        reason_when: 'adding',
        languages: SETTING_LANGUAGES,
        default: [] as [],
    }),
});

namingCategorySchema.register(z.globalRegistry, { id: 'namingCategory' });

const formatOverrideSchema = z
    .strictObject({
        paths: nonemptyPathsSchema.meta({
            description: 'The files these formatting values apply to.',
        }),
        indent_style: formatFieldsSchema.shape.indent_style
            .unwrap()
            .describe(formatFieldsSchema.shape.indent_style.description as string),
        indent_width: formatFieldsSchema.shape.indent_width
            .unwrap()
            .describe(formatFieldsSchema.shape.indent_width.description as string),
        print_width: formatFieldsSchema.shape.print_width
            .unwrap()
            .describe(formatFieldsSchema.shape.print_width.description as string),
        quotes: formatFieldsSchema.shape.quotes.describe(formatFieldsSchema.shape.quotes.description as string),
        trailing_commas: formatFieldsSchema.shape.trailing_commas
            .unwrap()
            .describe(formatFieldsSchema.shape.trailing_commas.description as string),
        semicolons: formatFieldsSchema.shape.semicolons
            .unwrap()
            .describe(formatFieldsSchema.shape.semicolons.description as string),
        bracket_spacing: formatFieldsSchema.shape.bracket_spacing
            .unwrap()
            .describe(formatFieldsSchema.shape.bracket_spacing.description as string),
        arrow_parens: formatFieldsSchema.shape.arrow_parens
            .unwrap()
            .describe(formatFieldsSchema.shape.arrow_parens.description as string),
        prose_wrap: formatFieldsSchema.shape.prose_wrap
            .unwrap()
            .describe(formatFieldsSchema.shape.prose_wrap.description as string),
    })
    .refine((override) => Object.keys(override).length > 1, {
        message: 'A format override needs at least one formatting option.',
    })
    .meta({ minProperties: FORMAT_OVERRIDE_MIN_FIELDS });

export const formatSchema = formatFieldsSchema.extend({
    override: formatOverrideSchema
        .array()
        .default([] as [])
        .meta({
            configurations: ['format'],
            description: 'Formatting options for repository-relative paths, in order.',
        }),
});
