import { z } from 'zod';
import { LIMIT_READERS } from '#cli/manifests/limits.ts';
import { allowReasonedValue } from '#cli/schemas/settings/fields.ts';
import type { LanguageLimitField, LanguageLimitSchemas } from '#cli/types/settings/values.ts';

export const limitFields = {
    file_lines: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['sql', 'structure'],
        description: 'The most lines one file may have, not counting blank lines and comment-only lines.',
        reason_when: 'raising',
        language_defaults: { sql: 400, bash: 140 },
        default: 300,
    }),
    function_lines: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The most lines one function may have.',
        reason_when: 'raising',
        language_defaults: { bash: 40 },
        default: 60,
    }),
    function_parameters: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The most parameters one function may take.',
        reason_when: 'raising',
        default: 7,
    }),
    function_statements: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The most statements one function may have.',
        reason_when: 'raising',
        default: 30,
    }),
    block_nesting: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'How deep blocks may nest inside one function.',
        reason_when: 'raising',
        default: 3,
    }),
    callback_nesting: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'How deep callbacks may nest.',
        reason_when: 'raising',
        default: 3,
    }),
    cognitive_complexity: allowReasonedValue(z.number().int().min(1).max(255), {
        configurations: ['structure'],
        description:
            'The highest cognitive score one function may have; the score grows as the function gets harder to follow.',
        reason_when: 'raising',
        default: 8,
    }),
    cyclomatic_complexity: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The most paths that may run through one function.',
        reason_when: 'raising',
        default: 8,
    }),
    function_branches: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The most branches one function may have.',
        reason_when: 'raising',
        default: 8,
    }),
    function_returns: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The most return statements one function may have.',
        reason_when: 'raising',
        default: 4,
    }),
    function_assignments: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The most variable assignments one shell function may make.',
        reason_when: 'raising',
        default: 8,
    }),
    closure_lines: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The most lines one Swift closure may have.',
        reason_when: 'raising',
        default: 60,
    }),
    type_lines: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The most lines one Swift type body may have.',
        reason_when: 'raising',
        default: 300,
    }),
    index_exports: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The most re-exports one index file may hold.',
        reason_when: 'raising',
        default: 20,
    }),
    trivial_function_statements: allowReasonedValue(z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description:
            'Functions with this many statements or fewer are reported, nested functions included. A higher number reports more functions.',
        reason_when: 'lowering',
        default: 2,
    }),
    shared_prefix_files: allowReasonedValue(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), {
        configurations: ['structure'],
        description: 'The number of siblings sharing a name prefix that makes a finding.',
        reason_when: 'raising',
        default: 2,
    }),
};

for (const [field, schema] of Object.entries(limitFields)) {
    const languages = [
        ...new Set(
            LIMIT_READERS.filter((reader) => reader.limits.includes(field)).flatMap((reader) => reader.languages),
        ),
    ];
    if (languages.length > 0) z.globalRegistry.add(schema, { ...schema.meta(), languages });
}

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

export const limitsSchema = z.strictObject({ ...limitFields, ...languageLimits });

limitsSchema.register(z.globalRegistry, { id: 'limits' });
