import { z } from 'zod';
import { ciFields } from '#cli/schemas/settings/ci.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { hooksSchema } from '#cli/schemas/settings/hooks.ts';
import { rulesSchema } from '#cli/schemas/settings/rules.ts';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { namingSchema } from '#cli/schemas/settings/naming.ts';
import { licensesSchema } from '#cli/schemas/settings/licenses.ts';
import { toolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import type { ToolTableSchemas } from '#cli/types/settings/tables.ts';
import { TABLE_DESCRIPTIONS } from '#cli/config/settings/json-schema.ts';
import { pythonSchema, javascriptSchema } from '#cli/schemas/settings/languages.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { FROZEN_ALL, FROZEN_NONE, FROZEN_VERSION } from '#cli/config/parsers/code/sql.ts';
import { commandSchema, nonemptyStringSchema } from '#cli/schemas/configurations/fields.ts';
import type { TableValues, TableSettings, WrittenSettings } from '#cli/types/settings/file.ts';
import { ALLOWED_WORD, REEXPORT_MODES, SPELLING_LOCALES } from '#cli/config/settings/tables.ts';

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
            environment_readers: allowReasonedValue(
                relativePathSchema.array(),
                SETTING_DEFINITIONS['structure.environment_readers'],
            ),
        } satisfies SchemaShape<TableSettings<'structure'>, NonNullable<WrittenSettings['structure']>>)
        .optional(),
    cloudflare: z
        .strictObject({
            types_file: destinationPathSchema
                .default(SETTING_DEFINITIONS['cloudflare.types_file'].default)
                .meta(SETTING_DEFINITIONS['cloudflare.types_file']),
            types_interface: nonemptyStringSchema
                .default(SETTING_DEFINITIONS['cloudflare.types_interface'].default)
                .meta(SETTING_DEFINITIONS['cloudflare.types_interface']),
        } satisfies SchemaShape<TableSettings<'cloudflare'>, NonNullable<WrittenSettings['cloudflare']>>)
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
                } satisfies SchemaShape<TableSettings<'coverage'>['swift_target'][number]>)
                .array()
                .default(SETTING_DEFINITIONS['coverage.swift_target'].default)
                .meta(SETTING_DEFINITIONS['coverage.swift_target']),
        } satisfies SchemaShape<TableSettings<'coverage'>, NonNullable<WrittenSettings['coverage']>>)
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
        } satisfies SchemaShape<TableSettings<'dependencies'>, NonNullable<WrittenSettings['dependencies']>>)
        .optional(),
    docs: z
        .strictObject({
            banned_headings: z
                .string()
                .array()
                .default(SETTING_DEFINITIONS['docs.banned_headings'].default)
                .meta(SETTING_DEFINITIONS['docs.banned_headings']),
            allowed_urls: allowReasonedValue(z.string().array(), SETTING_DEFINITIONS['docs.allowed_urls']),
        } satisfies SchemaShape<TableSettings<'docs'>, NonNullable<WrittenSettings['docs']>>)
        .optional(),
    drizzle: z
        .strictObject({
            client_names: nonemptyStringsSchema
                .default(SETTING_DEFINITIONS['drizzle.client_names'].default)
                .meta(SETTING_DEFINITIONS['drizzle.client_names']),
        } satisfies SchemaShape<TableSettings<'drizzle'>, NonNullable<WrittenSettings['drizzle']>>)
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
        } satisfies SchemaShape<TableSettings<'trpc'>, NonNullable<WrittenSettings['trpc']>>)
        .optional(),
    zustand: z
        .strictObject({
            store_files: allowReasonedValue(relativePathSchema.array(), SETTING_DEFINITIONS['zustand.store_files']),
        } satisfies SchemaShape<TableSettings<'zustand'>, NonNullable<WrittenSettings['zustand']>>)
        .optional(),
    licenses: licensesSchema.optional(),
    openapi: z
        .strictObject({
            document: relativePathSchema.optional().meta(SETTING_DEFINITIONS['openapi.document']),
            generate_command: commandSchema.optional().meta(SETTING_DEFINITIONS['openapi.generate_command']),
        } satisfies SchemaShape<TableSettings<'openapi'>, NonNullable<WrittenSettings['openapi']>>)
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
        } satisfies SchemaShape<TableSettings<'postgres'>, NonNullable<WrittenSettings['postgres']>>)
        .optional(),
    secrets: z
        .strictObject({
            env_examples: nonemptyStringsSchema
                .default(SETTING_DEFINITIONS['secrets.env_examples'].default)
                .meta(SETTING_DEFINITIONS['secrets.env_examples']),
            environment_functions: nonemptyStringsSchema
                .default(SETTING_DEFINITIONS['secrets.environment_functions'].default)
                .meta(SETTING_DEFINITIONS['secrets.environment_functions']),
        } satisfies SchemaShape<TableSettings<'secrets'>, NonNullable<WrittenSettings['secrets']>>)
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
                } satisfies SchemaShape<TableSettings<'site'>['size_limit'][number]>)
                .array()
                .default(SETTING_DEFINITIONS['site.size_limit'].default)
                .meta(SETTING_DEFINITIONS['site.size_limit']),
        } satisfies SchemaShape<TableSettings<'site'>, NonNullable<WrittenSettings['site']>>)
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
        } satisfies SchemaShape<TableSettings<'spelling'>, NonNullable<WrittenSettings['spelling']>>)
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
        } satisfies SchemaShape<TableSettings<'supabase'>, NonNullable<WrittenSettings['supabase']>>)
        .optional(),
    translations: z
        .strictObject({
            base_locale: nonemptyStringSchema
                .default(SETTING_DEFINITIONS['translations.base_locale'].default)
                .meta(SETTING_DEFINITIONS['translations.base_locale']),
            messages_folder: relativePathSchema.optional().meta(SETTING_DEFINITIONS['translations.messages_folder']),
        } satisfies SchemaShape<TableSettings<'translations'>, NonNullable<WrittenSettings['translations']>>)
        .optional(),
    swift: z
        .strictObject({
            xcode_project: relativePathSchema.optional().meta(SETTING_DEFINITIONS['swift.xcode_project']),
            xcode_scheme: nonemptyStringSchema.optional().meta(SETTING_DEFINITIONS['swift.xcode_scheme']),
            xcode_destination: nonemptyStringSchema
                .default(SETTING_DEFINITIONS['swift.xcode_destination'].default)
                .meta(SETTING_DEFINITIONS['swift.xcode_destination']),
        } satisfies SchemaShape<TableSettings<'swift'>, NonNullable<WrittenSettings['swift']>>)
        .optional(),
    repository: z
        .strictObject({
            max_file_kilobytes: allowReasonedValue(
                nonnegativeIntegerSchema,
                SETTING_DEFINITIONS['repository.max_file_kilobytes'],
            ),
        } satisfies SchemaShape<TableSettings<'repository'>, NonNullable<WrittenSettings['repository']>>)
        .optional(),
    prose: z
        .strictObject({
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
        } satisfies SchemaShape<TableSettings<'prose'>, NonNullable<WrittenSettings['prose']>>)
        .optional(),
    duplication: z
        .strictObject({
            min_lines: allowReasonedValue(z.number().int().positive(), SETTING_DEFINITIONS['duplication.min_lines']),
            min_tokens: allowReasonedValue(z.number().int().positive(), SETTING_DEFINITIONS['duplication.min_tokens']),
        } satisfies SchemaShape<TableSettings<'duplication'>, NonNullable<WrittenSettings['duplication']>>)
        .optional(),
    xcode: z
        .strictObject({
            allowed_entitlements: z
                .string()
                .array()
                .default(SETTING_DEFINITIONS['xcode.allowed_entitlements'].default)
                .meta(SETTING_DEFINITIONS['xcode.allowed_entitlements']),
        } satisfies SchemaShape<TableSettings<'xcode'>, NonNullable<WrittenSettings['xcode']>>)
        .optional(),
};

const toolTableSchemas = Object.fromEntries<z.ZodType>(
    Object.entries(toolsSchema.shape).map(([tool, schema]) => [`tools.${tool}`, schema]),
) as ToolTableSchemas;

export const tableValuesSchema = z
    .strictObject({
        ...configurationTableSchemas,
        format: formatSchema.prefault({}),
        ...toolTableSchemas,
    })
    .transform(stripUndefined) satisfies z.ZodType<TableValues>;

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
