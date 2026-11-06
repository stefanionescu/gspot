import { z } from 'zod';

import { ALLOWED_WORD, REEXPORT_MODES, SPELLING_LOCALES } from '#cli/config/settings/schema.ts';
import { nonemptyStringSchema } from '#cli/schemas/manifests/tools.ts';
import {
    allowReasonedValue,
    nonemptyStringsSchema,
    nonnegativeIntegerSchema,
    percentageSchema,
    relativePathSchema,
} from '#cli/schemas/settings/fields.ts';
import { licensesSchema } from '#cli/schemas/settings/tables.ts';

export const generalTableSchemas = {
    structure: z
        .strictObject({
            reexports: allowReasonedValue(z.enum(REEXPORT_MODES), {
                configurations: ['structure'],
                reason_for: 'adding',
                description: 'Where re-exports may go: none, or an index file that re-exports other files.',
                default: 'none',
            }),
            min_duplicate_lines: allowReasonedValue(z.int().positive(), {
                configurations: ['structure'],
                description: 'The fewest lines a copied block has before it counts.',
                reason_for: 'raising',
                default: 8,
            }),
            min_duplicate_tokens: allowReasonedValue(z.int().positive(), {
                configurations: ['structure'],
                description: 'The fewest tokens a copied block has before it counts.',
                reason_for: 'raising',
                default: 40,
            }),
            environment_readers: relativePathSchema
                .array()
                .default([])
                .meta({
                    configurations: ['structure'],
                    description:
                        'The files that may read environment variables; other files get the values passed in. Empty turns the check off.',
                }),
        })
        .optional(),
    coverage: z
        .strictObject({
            min_line_percent: allowReasonedValue(percentageSchema, {
                configurations: ['jest', 'pytest', 'vitest', 'swift'],
                description: 'The minimum percentage of source lines covered by tests.',
                default_all: 80,
                default: 0,
            }),
            min_branch_percent: allowReasonedValue(percentageSchema, {
                configurations: ['jest', 'vitest'],
                description: 'The minimum percentage of source branches covered by tests.',
                default_all: 80,
                default: 0,
            }),
            min_function_percent: allowReasonedValue(percentageSchema, {
                configurations: ['jest', 'vitest'],
                description: 'The minimum percentage of source functions covered by tests.',
                default_all: 80,
                default: 0,
            }),
            min_statement_percent: allowReasonedValue(percentageSchema, {
                configurations: ['jest', 'vitest'],
                description: 'The minimum percentage of source statements covered by tests.',
                default_all: 80,
                default: 0,
            }),
            swift_target: z
                .strictObject({
                    name: nonemptyStringSchema.meta({
                        description: 'A Swift target named in the coverage report.',
                    }),
                    min_line_percent: percentageSchema.meta({
                        description:
                            'The least share of lines that the target must cover, in place of `coverage.min_line_percent`.',
                    }),
                    reason: z.string().optional().meta({
                        description: 'Why this target may cover less.',
                    }),
                })
                .array()
                .default([])
                .meta({
                    leftOut: 'repository',
                    configurations: ['swift'],
                    description: 'Line coverage minimums for named Swift targets.',
                }),
        })
        .optional(),
    dependencies: z
        .strictObject({
            min_release_age_days: allowReasonedValue(nonnegativeIntegerSchema, {
                configurations: ['dependencies'],
                description: 'How many days a package waits after its release before gspot installs it.',
                default: 7,
            }),
            allowed_registries: allowReasonedValue(nonemptyStringsSchema, {
                configurations: ['dependencies'],
                description: 'The hosts a lockfile may resolve packages from.',
                reason_for: 'adding',
                default: ['registry.npmjs.org', 'registry.yarnpkg.com'],
            }),
            bun_scanner: nonemptyStringSchema.optional().meta({
                leftOut: 'code',
                configurations: ['dependencies'],
                description:
                    'The npm package that Bun runs as its install security scanner. Without it, Bun runs no scanner.',
            }),
        })
        .optional(),
    docs: z
        .strictObject({
            allowed_urls: allowReasonedValue(z.string().array(), {
                configurations: ['docs'],
                description: 'URL patterns that the link check skips; additions need a reason for the whole list.',
                reason_for: 'adding',
                default: [],
            }),
        })
        .optional(),
    licenses: licensesSchema.optional(),
    secrets: z
        .strictObject({
            environment_examples: nonemptyStringsSchema
                .default(['.env.example', '.env.template', '.env.sample', '.dev.vars.example'])
                .meta({
                    configurations: ['secrets'],
                    description:
                        'The example environment files to search for environment keys; a key may appear in any one of them.',
                }),
            environment_functions: nonemptyStringsSchema.default([]).meta({
                leftOut: 'repository',
                configurations: ['secrets'],
                description:
                    'Functions of this project that read environment variables, such as read_env. secrets/environment-examples reads the keys they take.',
            }),
        })
        .optional(),
    spelling: z
        .strictObject({
            locale: z
                .enum(SPELLING_LOCALES)
                .default('en')
                .meta({
                    configurations: ['spelling'],
                    description:
                        'The English locale typos checks against: en accepts every dialect; en-us, en-gb, en-ca, and en-au report the spellings of the other dialects. The fixer never changes a dialect spelling.',
                }),
            allowed_words: z
                .record(
                    z.string().regex(ALLOWED_WORD, 'Use a plain word, without a regular expression pattern.'),
                    z.string(),
                )
                .default({})
                .meta({
                    configurations: ['spelling'],
                    reason_values: true,
                    description:
                        'Words the spelling checks accept beyond the shipped spelling list, each with the reason it is a real word. A scope adds its words to the root words.',
                }),
        })
        .optional(),
    repository: z
        .strictObject({
            max_file_kilobytes: allowReasonedValue(nonnegativeIntegerSchema, {
                configurations: ['repository'],
                description:
                    'The largest file, in kilobytes, that Git may track without Git LFS or a linguist-generated or linguist-vendored mark in .gitattributes.',
                default: 1024,
            }),
        })
        .optional(),
    prose: z
        .strictObject({
            banned_headings: z
                .string()
                .array()
                .default([])
                .meta({
                    configurations: ['prose'],
                    description: 'Headings this repository bans beyond the shipped list.',
                }),
            max_sentence_words: allowReasonedValue(nonnegativeIntegerSchema, {
                configurations: ['prose'],
                description: 'The most words one sentence of documentation may have.',
                default: 30,
            }),
            max_list_item_words: allowReasonedValue(nonnegativeIntegerSchema, {
                configurations: ['prose'],
                description: 'The most words one list item may have.',
                default: 45,
            }),
            max_paragraph_sentences: allowReasonedValue(nonnegativeIntegerSchema, {
                configurations: ['prose'],
                description: 'The most sentences one paragraph may have.',
                default: 6,
            }),
        })
        .optional(),
};

export const hooksSchema = z.strictObject({
    enabled: z.boolean().default(true).meta({
        description: 'Install and run the configured Git hooks.',
    }),
});
