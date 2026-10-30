import { z } from 'zod';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { toolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import type { ToolTableSchemas } from '#cli/types/settings/tables.ts';
import { FROZEN_ALL, FROZEN_NONE, FROZEN_VERSION } from '#cli/config/parsers/code.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { commandSchema, nonemptyStringSchema } from '#cli/schemas/manifests/fields.ts';
import { ALLOWED_WORD, REEXPORT_MODES, SPELLING_LOCALES, TABLE_DESCRIPTIONS } from '#cli/config/settings/settings.ts';

import {
    ciFields,
    hooksSchema,
    rulesSchema,
    namingSchema,
    pythonSchema,
    licensesSchema,
    javascriptSchema,
} from '#cli/schemas/settings/settings.ts';
import {
    formatSchema,
    percentageSchema,
    relativePathSchema,
    allowReasonedValue,
    nonemptyStringsSchema,
    destinationPathSchema,
    nonnegativeIntegerSchema,
} from '#cli/schemas/settings/fields.ts';

export const configurationTableSchemas = {
    format: formatSchema.optional(),
    limits: limitsSchema.optional(),
    naming: namingSchema.optional(),
    structure: z
        .strictObject({
            reexports: allowReasonedValue(z.enum(REEXPORT_MODES), SETTING_DEFINITIONS['structure.reexports']),
            environment_readers: relativePathSchema
                .array()
                .default(SETTING_DEFINITIONS['structure.environment_readers'].default)
                .meta(SETTING_DEFINITIONS['structure.environment_readers']),
        })
        .optional(),
    cloudflare: z
        .strictObject({
            types_file: destinationPathSchema
                .default(SETTING_DEFINITIONS['cloudflare.types_file'].default)
                .meta(SETTING_DEFINITIONS['cloudflare.types_file']),
            types_interface: nonemptyStringSchema
                .default(SETTING_DEFINITIONS['cloudflare.types_interface'].default)
                .meta(SETTING_DEFINITIONS['cloudflare.types_interface']),
        })
        .optional(),
    coverage: z
        .strictObject({
            lines: allowReasonedValue(percentageSchema, SETTING_DEFINITIONS['coverage.lines']),
            branches: allowReasonedValue(percentageSchema, SETTING_DEFINITIONS['coverage.branches']),
            functions: allowReasonedValue(percentageSchema, SETTING_DEFINITIONS['coverage.functions']),
            statements: allowReasonedValue(percentageSchema, SETTING_DEFINITIONS['coverage.statements']),
            swift_target: z
                .strictObject({
                    name: nonemptyStringSchema.meta(SETTING_DEFINITIONS['coverage.swift_target.name']),
                    lines: percentageSchema.meta(SETTING_DEFINITIONS['coverage.swift_target.lines']),
                    reason: z.string().optional().meta(SETTING_DEFINITIONS['coverage.swift_target.reason']),
                })
                .array()
                .default(SETTING_DEFINITIONS['coverage.swift_target'].default)
                .meta(SETTING_DEFINITIONS['coverage.swift_target']),
        })
        .optional(),
    dependencies: z
        .strictObject({
            min_release_age_days: allowReasonedValue(
                nonnegativeIntegerSchema,
                SETTING_DEFINITIONS['dependencies.min_release_age_days'],
            ),
            allowed_registries: allowReasonedValue(
                nonemptyStringsSchema,
                SETTING_DEFINITIONS['dependencies.allowed_registries'],
            ),
            bun_scanner: nonemptyStringSchema.optional().meta(SETTING_DEFINITIONS['dependencies.bun_scanner']),
        })
        .optional(),
    docs: z
        .strictObject({
            allowed_urls: allowReasonedValue(z.string().array(), SETTING_DEFINITIONS['docs.allowed_urls']),
        })
        .optional(),
    drizzle: z
        .strictObject({
            client_names: nonemptyStringsSchema
                .default(SETTING_DEFINITIONS['drizzle.client_names'].default)
                .meta(SETTING_DEFINITIONS['drizzle.client_names']),
        })
        .optional(),
    javascript: javascriptSchema,
    python: pythonSchema,
    trpc: z
        .strictObject({
            router_files: relativePathSchema
                .array()
                .default(SETTING_DEFINITIONS['trpc.router_files'].default)
                .meta(SETTING_DEFINITIONS['trpc.router_files']),
            server_files: relativePathSchema
                .array()
                .default(SETTING_DEFINITIONS['trpc.server_files'].default)
                .meta(SETTING_DEFINITIONS['trpc.server_files']),
        })
        .optional(),
    zustand: z
        .strictObject({
            store_files: allowReasonedValue(relativePathSchema.array(), SETTING_DEFINITIONS['zustand.store_files']),
        })
        .optional(),
    licenses: licensesSchema.optional(),
    openapi: z
        .strictObject({
            document: relativePathSchema.optional().meta(SETTING_DEFINITIONS['openapi.document']),
            generate_command: commandSchema.optional().meta(SETTING_DEFINITIONS['openapi.generate_command']),
        })
        .optional(),
    postgres: z
        .strictObject({
            client_schemas: nonemptyStringsSchema
                .default(SETTING_DEFINITIONS['postgres.client_schemas'].default)
                .meta(SETTING_DEFINITIONS['postgres.client_schemas']),
            frozen_through: z
                .union([z.enum([FROZEN_NONE, FROZEN_ALL]), z.string().regex(FROZEN_VERSION)])
                .default(SETTING_DEFINITIONS['postgres.frozen_through'].default)
                .meta(SETTING_DEFINITIONS['postgres.frozen_through']),
            migrations_folder: relativePathSchema.optional().meta(SETTING_DEFINITIONS['postgres.migrations_folder']),
        })
        .optional(),
    secrets: z
        .strictObject({
            env_examples: nonemptyStringsSchema
                .default(SETTING_DEFINITIONS['secrets.env_examples'].default)
                .meta(SETTING_DEFINITIONS['secrets.env_examples']),
            environment_functions: nonemptyStringsSchema
                .default(SETTING_DEFINITIONS['secrets.environment_functions'].default)
                .meta(SETTING_DEFINITIONS['secrets.environment_functions']),
        })
        .optional(),
    site: z
        .strictObject({
            build_command: commandSchema
                .default(SETTING_DEFINITIONS['site.build_command'].default)
                .meta(SETTING_DEFINITIONS['site.build_command']),
            build_folder: destinationPathSchema
                .default(SETTING_DEFINITIONS['site.build_folder'].default)
                .meta(SETTING_DEFINITIONS['site.build_folder']),
            allowed_unlisted_pages: allowReasonedValue(
                relativePathSchema.meta({ path_role: 'build' }).array(),
                SETTING_DEFINITIONS['site.allowed_unlisted_pages'],
            ),
            size_limit: z
                .strictObject({
                    paths: destinationPathSchema.array().min(1).meta(SETTING_DEFINITIONS['site.size_limit.paths']),
                    kilobytes: nonnegativeIntegerSchema.describe(
                        SETTING_DEFINITIONS['site.size_limit.kilobytes'].description,
                    ),
                })
                .array()
                .default(SETTING_DEFINITIONS['site.size_limit'].default)
                .meta(SETTING_DEFINITIONS['site.size_limit']),
        })
        .optional(),
    spelling: z
        .strictObject({
            locale: z
                .enum(SPELLING_LOCALES)
                .default(SETTING_DEFINITIONS['spelling.locale'].default)
                .meta(SETTING_DEFINITIONS['spelling.locale']),
            allowed_words: z
                .record(
                    z.string().regex(ALLOWED_WORD, 'Use a plain word, without a regular expression pattern.'),
                    z.string(),
                )
                .default(SETTING_DEFINITIONS['spelling.allowed_words'].default)
                .meta(SETTING_DEFINITIONS['spelling.allowed_words']),
        })
        .optional(),
    supabase: z
        .strictObject({
            functions_folder: relativePathSchema
                .default(SETTING_DEFINITIONS['supabase.functions_folder'].default)
                .meta(SETTING_DEFINITIONS['supabase.functions_folder']),
            schemas: nonemptyStringsSchema
                .default(SETTING_DEFINITIONS['supabase.schemas'].default)
                .meta(SETTING_DEFINITIONS['supabase.schemas']),
            types_file: destinationPathSchema.optional().meta(SETTING_DEFINITIONS['supabase.types_file']),
        })
        .optional(),
    translations: z
        .strictObject({
            base_locale: nonemptyStringSchema
                .default(SETTING_DEFINITIONS['translations.base_locale'].default)
                .meta(SETTING_DEFINITIONS['translations.base_locale']),
            messages_folder: relativePathSchema.optional().meta(SETTING_DEFINITIONS['translations.messages_folder']),
        })
        .optional(),
    swift: z
        .strictObject({
            xcode_project: relativePathSchema.optional().meta(SETTING_DEFINITIONS['swift.xcode_project']),
            xcode_scheme: nonemptyStringSchema.optional().meta(SETTING_DEFINITIONS['swift.xcode_scheme']),
            xcode_destination: nonemptyStringSchema
                .default(SETTING_DEFINITIONS['swift.xcode_destination'].default)
                .meta(SETTING_DEFINITIONS['swift.xcode_destination']),
        })
        .optional(),
    repository: z
        .strictObject({
            max_file_kilobytes: allowReasonedValue(
                nonnegativeIntegerSchema,
                SETTING_DEFINITIONS['repository.max_file_kilobytes'],
            ),
        })
        .optional(),
    prose: z
        .strictObject({
            banned_headings: z
                .string()
                .array()
                .default(SETTING_DEFINITIONS['prose.banned_headings'].default)
                .meta(SETTING_DEFINITIONS['prose.banned_headings']),
            max_sentence_words: allowReasonedValue(
                nonnegativeIntegerSchema,
                SETTING_DEFINITIONS['prose.max_sentence_words'],
            ),
            max_list_item_words: allowReasonedValue(
                nonnegativeIntegerSchema,
                SETTING_DEFINITIONS['prose.max_list_item_words'],
            ),
            max_paragraph_sentences: allowReasonedValue(
                nonnegativeIntegerSchema,
                SETTING_DEFINITIONS['prose.max_paragraph_sentences'],
            ),
        })
        .optional(),
    duplication: z
        .strictObject({
            min_lines: allowReasonedValue(z.number().int().positive(), SETTING_DEFINITIONS['duplication.min_lines']),
            min_tokens: allowReasonedValue(z.number().int().positive(), SETTING_DEFINITIONS['duplication.min_tokens']),
        })
        .optional(),
    xcode: z
        .strictObject({
            allowed_entitlements: z
                .string()
                .array()
                .default(SETTING_DEFINITIONS['xcode.allowed_entitlements'].default)
                .meta(SETTING_DEFINITIONS['xcode.allowed_entitlements']),
        })
        .optional(),
};

const toolTableSchemas = Object.fromEntries<z.ZodType>(
    Object.entries(toolsSchema.shape).map(([tool, schema]) => [`tools.${tool}`, schema]),
) as ToolTableSchemas;

export const tableValuesSchema = z.strictObject({
    ...configurationTableSchemas,
    format: formatSchema.prefault({}),
    ...toolTableSchemas,
});

for (const [name, schema] of Object.entries(configurationTableSchemas)) {
    const description = TABLE_DESCRIPTIONS[name];
    if (description !== undefined)
        z.globalRegistry.add(schema, {
            ...schema.meta(),
            ...(schema.unwrap().meta()?.id === undefined ? { id: name } : {}),
            description,
        });
}

export const tableSettingSchemas = Object.fromEntries(
    Object.entries({ hooks: hooksSchema.shape, ci: ciFields, rules: rulesSchema.shape }).flatMap(([section, fields]) =>
        Object.entries<z.ZodType>(fields).map(
            ([key, field]) =>
                [
                    `${section}.${key}`,
                    field.safeParse(undefined).success ? field : field.optional().describe(field.description ?? ''),
                ] as const,
        ),
    ),
);
