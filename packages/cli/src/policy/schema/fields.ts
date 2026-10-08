import { z } from 'zod';
import { LocalDate } from '@decimalturn/toml-patch';
import { INDENT_MAX, PRINT_WIDTH_MAX, PRINT_WIDTH_MIN } from '#cli/config/policy/settings.ts';

function rolePaths() {
    return z.union([relativePath, z.array(relativePath)]);
}

const formatFields = z.strictObject({
    indent_style: z.enum(['space', 'tab']).optional(),
    indent_width: z.number().int().min(1).max(INDENT_MAX).optional(),
    print_width: z.number().int().min(PRINT_WIDTH_MIN).max(PRINT_WIDTH_MAX).optional(),
    line_ending: z.enum(['lf', 'crlf']).optional(),
    final_newline: z.boolean().optional(),
    quotes: z.enum(['single', 'double']).optional(),
    trailing_commas: z.enum(['all', 'es5', 'none']).optional(),
    semicolons: z.boolean().optional(),
});

export const relativePath = z
    .string()
    .min(1)
    .regex(
        /^(?!\/)(?![\s\S]*(?:^|\/)\.\.(?:\/|$))[^\\:\p{Cc}]+$/u,
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    )
    .meta({ pathRole: 'source' });

/** Project environment reader names retain the native nonempty-string constraint. */
export const environmentReadersSchema = z.array(z.string().min(1));

/** Per-language naming limits and spelling styles. Reasons live in the table that owns these plain values. */
export const namingCategorySchema = z.strictObject({
    max_chars: z.number().optional(),
    max_words: z.number().optional(),
    case: z.array(z.string()).optional(),
});

/** Numeric limits at both authored and resolved policy boundaries. */
export const limitTableSchema = z.record(z.string(), z.number());

/** The calendar form used by CLI date arguments and the editor's JSON representation. */
export const calendarDateSchema = z.iso.date();

/** Runtime expiry values retain unquoted TOML local dates. */
export const localDateSchema = z.custom<LocalDate>(
    (value) => value instanceof LocalDate && calendarDateSchema.safeParse(value.toISOString()).success,
    { error: 'Use an unquoted TOML local date in YYYY-MM-DD form, without a time or offset.' },
);

/**
 * Keep a native default visible to editors without adding it to authored policy.
 * @param field the native validator and its execution default
 * @returns the optional authored field with the same validator and default metadata
 */
export function authoredDefault<Schema extends z.ZodType>(field: z.ZodDefault<Schema>): z.ZodOptional<Schema> {
    return field
        .unwrap()
        .optional()
        .meta({ default: field.parse(undefined) });
}

/**
 * Apply an authored field's declared default at the execution boundary.
 * @param field the optional native field and its declared default
 * @param value the authored value, when present
 * @returns the validated execution value
 */
export function defaultValue<Schema extends z.ZodType>(field: z.ZodOptional<Schema>, value: unknown): z.output<Schema> {
    return field.unwrap().parse(value === undefined ? field.meta()?.['default'] : value);
}

/** The six architecture roles read by gspot without a configuration declaration. */
export const architectureRolesSchema = z.strictObject({
    tests: rolePaths().optional(),
    types: rolePaths().optional(),
    config: rolePaths().optional(),
    test_harness: rolePaths().optional(),
    runtime: rolePaths().optional(),
    env: rolePaths().optional(),
});

export const formatSchema = formatFields.extend({
    overrides: z
        .array(
            formatFields
                .extend({ paths: z.array(relativePath).min(1) })
                .refine((entry) => Object.keys(entry).length > 1, {
                    message: 'A format override needs at least one formatting option.',
                })
                .meta({ minProperties: 2 }),
        )
        .optional(),
});
