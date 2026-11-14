import { z } from 'zod';
import { LIMIT_READERS } from '#cli/manifests/limits.ts';
import { BIOME_COMPLEXITY_MAX } from '#cli/config/settings/tables.ts';
import type { LanguageLimitField, LanguageLimitSchemas } from '#cli/types/settings.ts';
import { allowReasonedValue, nonnegativeIntegerSchema } from '#cli/schemas/settings/fields.ts';

function addLimitLanguages<Fields extends Record<string, z.ZodType>>(fields: Fields): Fields {
    for (const [field, schema] of Object.entries(fields)) {
        const languages = [
            ...new Set(
                LIMIT_READERS.filter((reader) => reader.limits.includes(field)).flatMap((reader) => reader.languages),
            ),
        ];
        if (languages.length > 0) z.globalRegistry.add(schema, { ...schema.meta(), languages });
    }
    return fields;
}

export const limitFields = addLimitLanguages({
    max_file_lines: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['sql', 'structure'],
        description: 'The most lines one file may have, not counting blank lines and comment-only lines.',
        language_defaults: { sql: 400, bash: 140 },
        default: 300,
    }),
    max_function_lines: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The most lines one function may have.',
        language_defaults: { bash: 40 },
        default: 60,
    }),
    max_function_parameters: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The most parameters one function may take.',
        default: 7,
    }),
    max_function_statements: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The most statements one function may have.',
        default: 30,
    }),
    max_block_nesting: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'How deep blocks may nest inside one function.',
        default: 3,
    }),
    max_callback_nesting: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'How deep callbacks may nest.',
        default: 3,
    }),
    max_cognitive_complexity: allowReasonedValue(z.int().min(1).max(BIOME_COMPLEXITY_MAX), {
        configurations: ['structure'],
        description:
            'The highest cognitive score one function may have; the score grows as the function gets harder to follow.',
        default: 15,
    }),
    max_cyclomatic_complexity: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The most paths that may run through one function.',
        default: 8,
    }),
    max_function_branches: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The most branches one function may have.',
        default: 8,
    }),
    max_function_returns: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The most return statements one function may have.',
        default: 4,
    }),
    max_function_assignments: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The most variable assignments one shell function may make.',
        default: 8,
    }),
    max_closure_lines: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The most lines one Swift closure may have.',
        default: 60,
    }),
    max_type_lines: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The most lines one Swift type body may have.',
        default: 300,
    }),
    max_index_exports: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The most re-exports one index file may hold.',
        default: 20,
    }),
    trivial_function_statements: allowReasonedValue(z.int().min(1), {
        configurations: ['structure'],
        description:
            'A function with this many statements or fewer, nested functions included, is reported when at most one place calls it.',
        reason_for: 'lowering',
        default: 2,
    }),
    min_shared_prefix_files: allowReasonedValue(nonnegativeIntegerSchema, {
        configurations: ['structure'],
        description: 'The number of siblings sharing a name prefix that makes a finding.',
        reason_for: 'raising',
        default: 2,
    }),
});

const languageLimitFieldsSchema = z.strictObject(limitFields).partial();
const languageLimits = Object.fromEntries(
    [...new Set(LIMIT_READERS.flatMap((reader) => reader.languages))].map((language) => {
        const fields = new Set(
            LIMIT_READERS.filter((reader) => reader.languages.includes(language)).flatMap((reader) => reader.limits),
        );
        return [
            language,
            languageLimitFieldsSchema
                .pick(
                    Object.fromEntries(
                        Object.keys(limitFields)
                            .filter((field) => fields.has(field))
                            .map((field) => [field, true]),
                    ) as Record<keyof LanguageLimitField, true>,
                )
                .optional()
                .meta({
                    variantOf: 'limits',
                    description: `Size and complexity limits for ${language} files and functions.`,
                }),
        ];
    }),
) as LanguageLimitSchemas;

export const limitsSchema = z
    .strictObject({ ...limitFields, ...languageLimits })
    .register(z.globalRegistry, { id: 'limits' });
