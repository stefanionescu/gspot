import { z } from 'zod';
import { licensesSchema } from '#cli/schemas/settings/settings.ts';
import { nonemptyStringSchema } from '#cli/schemas/manifests/fields.ts';
import { ALLOWED_WORD, REEXPORT_MODES, SPELLING_LOCALES } from '#cli/config/settings/schema.ts';

import {
    percentageSchema,
    relativePathSchema,
    allowReasonedValue,
    nonemptyStringsSchema,
    nonnegativeIntegerSchema,
} from '#cli/schemas/settings/fields.ts';

export const generalTableSchemas = {
    structure: z
        .strictObject({
            reexports: allowReasonedValue(z.enum(REEXPORT_MODES), {
                configurations: ['structure'],
                reason_when: 'adding',
                description: 'Where re-exports may go: none, or an index file that re-exports other files.',
                default: 'none',
            }),
            environment_readers: relativePathSchema
                .array()
                .default([] as [])
                .meta({
                    configurations: ['structure'],
                    description:
                        'The files that may read environment variables; other files get the values passed in. Empty turns the check off.',
                }),
        })
        .optional(),
    coverage: z
        .strictObject({
            lines: allowReasonedValue(percentageSchema, {
                configurations: ['jest', 'pytest', 'vitest', 'swift'],
                description: 'The minimum percentage of source lines covered by tests.',
                default_all: 80,
                reason_when: 'lowering',
                default: 0,
            }),
            branches: allowReasonedValue(percentageSchema, {
                configurations: ['jest', 'vitest'],
                description: 'The minimum percentage of source branches covered by tests.',
                default_all: 80,
                reason_when: 'lowering',
                default: 0,
            }),
            functions: allowReasonedValue(percentageSchema, {
                configurations: ['jest', 'vitest'],
                description: 'The minimum percentage of source functions covered by tests.',
                default_all: 80,
                reason_when: 'lowering',
                default: 0,
            }),
            statements: allowReasonedValue(percentageSchema, {
                configurations: ['jest', 'vitest'],
                description: 'The minimum percentage of source statements covered by tests.',
                default_all: 80,
                reason_when: 'lowering',
                default: 0,
            }),
            swift_target: z
                .strictObject({
                    name: nonemptyStringSchema.meta({
                        description: 'A Swift target named in the coverage report.',
                    }),
                    lines: percentageSchema.meta({
                        description:
                            'The least share of lines that the target must cover, in place of `coverage.lines`.',
                    }),
                    reason: z.string().optional().meta({
                        description: 'Why this target may cover less.',
                    }),
                })
                .array()
                .default([] as [])
                .meta({
                    template: 'repository',
                    configurations: ['swift'],
                    description: 'Line coverage minimums for named Swift targets.',
                }),
        })
        .optional(),
    dependencies: z
        .strictObject({
            min_release_age_days: allowReasonedValue(nonnegativeIntegerSchema, {
                configurations: ['dependencies'],
                description:
                    'How many days a package waits after its release before gspot installs it in .gspot. The hold covers the pinned tools and the packages they pull in; only the gspot packages install at the version of the CLI. A pinned tool that came out later stops the install. Bun does not hold back a package pinned to one version. gspot applies the hold when it writes a tool lockfile: a committed tool lockfile that matches the pins installs as it is, without the hold.',
                reason_when: 'lowering',
                default: 7,
            }),
            allowed_registries: allowReasonedValue(nonemptyStringsSchema, {
                configurations: ['dependencies'],
                description: 'The hosts a lockfile may resolve packages from.',
                reason_when: 'adding',
                default: ['registry.npmjs.org', 'registry.yarnpkg.com'] as [
                    'registry.npmjs.org',
                    'registry.yarnpkg.com',
                ],
            }),
            bun_scanner: nonemptyStringSchema.optional().meta({
                template: 'code',
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
                description: 'Allowed URL patterns; additions need a reason for the whole list.',
                reason_when: 'adding',
                default: [] as [],
            }),
        })
        .optional(),
    licenses: licensesSchema.optional(),
    secrets: z
        .strictObject({
            env_examples: nonemptyStringsSchema
                .default(['.env.example', '.env.template', '.env.sample', '.dev.vars.example'] as [
                    '.env.example',
                    '.env.template',
                    '.env.sample',
                    '.dev.vars.example',
                ])
                .meta({
                    configurations: ['secrets'],
                    description:
                        'The example environment files to search for environment keys; a key may appear in any one of them.',
                }),
            environment_functions: nonemptyStringsSchema.default([] as []).meta({
                template: 'repository',
                configurations: ['secrets'],
                description:
                    'Functions of this project that read environment variables, such as read_env. secrets/env-examples reads the keys they take.',
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
                reason_when: 'raising',
                default: 1024,
            }),
        })
        .optional(),
    prose: z
        .strictObject({
            banned_headings: z
                .string()
                .array()
                .default([] as [])
                .meta({
                    configurations: ['prose'],
                    description: 'Headings this repository bans beyond the shipped list.',
                }),
            max_sentence_words: allowReasonedValue(nonnegativeIntegerSchema, {
                configurations: ['prose'],
                description: 'The most words one sentence of documentation may have.',
                reason_when: 'raising',
                default: 30,
            }),
            max_list_item_words: allowReasonedValue(nonnegativeIntegerSchema, {
                configurations: ['prose'],
                description: 'The most words one list item may have.',
                reason_when: 'raising',
                default: 45,
            }),
            max_paragraph_sentences: allowReasonedValue(nonnegativeIntegerSchema, {
                configurations: ['prose'],
                description: 'The most sentences one paragraph may have.',
                reason_when: 'raising',
                default: 6,
            }),
        })
        .optional(),
    duplication: z
        .strictObject({
            min_lines: allowReasonedValue(z.number().int().positive(), {
                configurations: ['duplication'],
                description: 'The fewest lines a copied block has before it counts.',
                reason_when: 'raising',
                default: 8,
            }),
            min_tokens: allowReasonedValue(z.number().int().positive(), {
                configurations: ['duplication'],
                description: 'The fewest tokens a copied block has before it counts.',
                reason_when: 'raising',
                default: 40,
            }),
        })
        .optional(),
};
