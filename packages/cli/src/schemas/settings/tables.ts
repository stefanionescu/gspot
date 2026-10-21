import { z } from 'zod';
import { stripUndefined } from '#cli/system/values.ts';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { toolsSchema } from '#cli/schemas/settings/tools.ts';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { namingSchema } from '#cli/schemas/settings/naming.ts';
import { licensesSchema } from '#cli/schemas/settings/licenses.ts';
import { type WrittenSettings } from '#cli/types/settings/file.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { REEXPORT_MODES, SPELLING_LOCALES } from '#cli/config/settings/schema.ts';
import { pythonSchema, javascriptSchema } from '#cli/schemas/settings/languages.ts';
import { commandSchema, nonemptyString } from '#cli/schemas/configurations/parts.ts';
import { ciFields, hooksSchema, rulesSchema } from '#cli/schemas/settings/integrations.ts';
import { type TableValues, type TableSettings, type ToolTableSchemas } from '#cli/types/settings/tables.ts';

import {
    percentage,
    wholeNumber,
    formatSchema,
    relativePath,
    nonemptyStrings,
    destinationPath,
    allowReasonedValue,
} from '#cli/schemas/settings/parts.ts';

const configurationTableSchemas = {
    format: formatSchema.optional(),
    limits: limitsSchema.optional(),
    naming: namingSchema.optional(),
    structure: z
        .strictObject({
            reexports: allowReasonedValue(z.enum(REEXPORT_MODES), SETTING_DECLARATIONS['structure.reexports']),
            environment_readers: z
                .array(relativePath)
                .default(SETTING_DECLARATIONS['structure.environment_readers'].default)
                .meta(SETTING_DECLARATIONS['structure.environment_readers']),
        } satisfies SchemaShape<TableSettings<'structure'>, NonNullable<WrittenSettings['structure']>>)
        .optional(),
    cloudflare: z
        .strictObject({
            types_file: destinationPath
                .default(SETTING_DECLARATIONS['cloudflare.types_file'].default)
                .meta(SETTING_DECLARATIONS['cloudflare.types_file']),
            types_interface: nonemptyString
                .default(SETTING_DECLARATIONS['cloudflare.types_interface'].default)
                .meta(SETTING_DECLARATIONS['cloudflare.types_interface']),
        } satisfies SchemaShape<TableSettings<'cloudflare'>, NonNullable<WrittenSettings['cloudflare']>>)
        .optional(),
    coverage: z
        .strictObject({
            lines: allowReasonedValue(percentage, SETTING_DECLARATIONS['coverage.lines']),
            branches: allowReasonedValue(percentage, SETTING_DECLARATIONS['coverage.branches']),
            functions: allowReasonedValue(percentage, SETTING_DECLARATIONS['coverage.functions']),
            statements: allowReasonedValue(percentage, SETTING_DECLARATIONS['coverage.statements']),
            swift_target: z
                .array(
                    z.strictObject({
                        name: nonemptyString.describe(SETTING_DECLARATIONS['coverage.swift_target.name'].description),
                        lines: percentage.describe(SETTING_DECLARATIONS['coverage.swift_target.lines'].description),
                        reason: z
                            .string()
                            .optional()
                            .describe(SETTING_DECLARATIONS['coverage.swift_target.reason'].description),
                    } satisfies SchemaShape<TableSettings<'coverage'>['swift_target'][number]>),
                )
                .default(SETTING_DECLARATIONS['coverage.swift_target'].default)
                .meta(SETTING_DECLARATIONS['coverage.swift_target']),
        } satisfies SchemaShape<TableSettings<'coverage'>, NonNullable<WrittenSettings['coverage']>>)
        .optional(),
    dependencies: z
        .strictObject({
            min_release_age_days: allowReasonedValue(
                wholeNumber,
                SETTING_DECLARATIONS['dependencies.min_release_age_days'],
            ),
            allowed_registries: allowReasonedValue(
                nonemptyStrings,
                SETTING_DECLARATIONS['dependencies.allowed_registries'],
            ),
            bun_scanner: nonemptyString.optional().meta(SETTING_DECLARATIONS['dependencies.bun_scanner']),
        } satisfies SchemaShape<TableSettings<'dependencies'>, NonNullable<WrittenSettings['dependencies']>>)
        .optional(),
    docs: z
        .strictObject({
            banned_headings: z
                .array(z.string())
                .default(SETTING_DECLARATIONS['docs.banned_headings'].default)
                .meta(SETTING_DECLARATIONS['docs.banned_headings']),
            allowed_urls: allowReasonedValue(z.array(z.string()), SETTING_DECLARATIONS['docs.allowed_urls']),
        } satisfies SchemaShape<TableSettings<'docs'>, NonNullable<WrittenSettings['docs']>>)
        .optional(),
    drizzle: z
        .strictObject({
            client_names: nonemptyStrings
                .default(SETTING_DECLARATIONS['drizzle.client_names'].default)
                .meta(SETTING_DECLARATIONS['drizzle.client_names']),
        } satisfies SchemaShape<TableSettings<'drizzle'>, NonNullable<WrittenSettings['drizzle']>>)
        .optional(),
    javascript: javascriptSchema,
    python: pythonSchema,
    trpc: z
        .strictObject({
            router_files: z
                .array(relativePath)
                .default(SETTING_DECLARATIONS['trpc.router_files'].default)
                .meta(SETTING_DECLARATIONS['trpc.router_files']),
            server_files: z
                .array(relativePath)
                .default(SETTING_DECLARATIONS['trpc.server_files'].default)
                .meta(SETTING_DECLARATIONS['trpc.server_files']),
        } satisfies SchemaShape<TableSettings<'trpc'>, NonNullable<WrittenSettings['trpc']>>)
        .optional(),
    zustand: z
        .strictObject({
            store_files: z
                .array(relativePath)
                .default(SETTING_DECLARATIONS['zustand.store_files'].default)
                .meta(SETTING_DECLARATIONS['zustand.store_files']),
        } satisfies SchemaShape<TableSettings<'zustand'>, NonNullable<WrittenSettings['zustand']>>)
        .optional(),
    licenses: licensesSchema.optional(),
    openapi: z
        .strictObject({
            document: relativePath.optional().meta(SETTING_DECLARATIONS['openapi.document']),
            generate_command: commandSchema.optional().meta(SETTING_DECLARATIONS['openapi.generate_command']),
        } satisfies SchemaShape<TableSettings<'openapi'>, NonNullable<WrittenSettings['openapi']>>)
        .optional(),
    postgres: z
        .strictObject({
            client_schemas: nonemptyStrings
                .default(SETTING_DECLARATIONS['postgres.client_schemas'].default)
                .meta(SETTING_DECLARATIONS['postgres.client_schemas']),
            frozen_through: nonemptyString
                .default(SETTING_DECLARATIONS['postgres.frozen_through'].default)
                .meta(SETTING_DECLARATIONS['postgres.frozen_through']),
            migrations_folder: relativePath.optional().meta(SETTING_DECLARATIONS['postgres.migrations_folder']),
        } satisfies SchemaShape<TableSettings<'postgres'>, NonNullable<WrittenSettings['postgres']>>)
        .optional(),
    secrets: z
        .strictObject({
            env_examples: nonemptyStrings
                .default(SETTING_DECLARATIONS['secrets.env_examples'].default)
                .meta(SETTING_DECLARATIONS['secrets.env_examples']),
            environment_functions: nonemptyStrings
                .default(SETTING_DECLARATIONS['secrets.environment_functions'].default)
                .meta(SETTING_DECLARATIONS['secrets.environment_functions']),
        } satisfies SchemaShape<TableSettings<'secrets'>, NonNullable<WrittenSettings['secrets']>>)
        .optional(),
    site: z
        .strictObject({
            build_command: commandSchema
                .default(SETTING_DECLARATIONS['site.build_command'].default)
                .meta(SETTING_DECLARATIONS['site.build_command']),
            build_folder: destinationPath
                .default(SETTING_DECLARATIONS['site.build_folder'].default)
                .meta(SETTING_DECLARATIONS['site.build_folder']),
            allowed_unlisted_pages: allowReasonedValue(
                z.array(relativePath.meta({ pathRole: 'build' })),
                SETTING_DECLARATIONS['site.allowed_unlisted_pages'],
            ),
            size_limit: z
                .array(
                    z.strictObject({
                        paths: z
                            .array(destinationPath)
                            .min(1)
                            .describe(SETTING_DECLARATIONS['site.size_limit.paths'].description),
                        kilobytes: wholeNumber.describe(SETTING_DECLARATIONS['site.size_limit.kilobytes'].description),
                    } satisfies SchemaShape<TableSettings<'site'>['size_limit'][number]>),
                )
                .default(SETTING_DECLARATIONS['site.size_limit'].default)
                .meta(SETTING_DECLARATIONS['site.size_limit']),
        } satisfies SchemaShape<TableSettings<'site'>, NonNullable<WrittenSettings['site']>>)
        .optional(),
    spelling: z
        .strictObject({
            locale: z
                .enum(SPELLING_LOCALES)
                .default(SETTING_DECLARATIONS['spelling.locale'].default)
                .meta(SETTING_DECLARATIONS['spelling.locale']),
        } satisfies SchemaShape<TableSettings<'spelling'>, NonNullable<WrittenSettings['spelling']>>)
        .optional(),
    supabase: z
        .strictObject({
            functions_folder: relativePath
                .default(SETTING_DECLARATIONS['supabase.functions_folder'].default)
                .meta(SETTING_DECLARATIONS['supabase.functions_folder']),
            schemas: nonemptyStrings
                .default(SETTING_DECLARATIONS['supabase.schemas'].default)
                .meta(SETTING_DECLARATIONS['supabase.schemas']),
            types_file: destinationPath.optional().meta(SETTING_DECLARATIONS['supabase.types_file']),
        } satisfies SchemaShape<TableSettings<'supabase'>, NonNullable<WrittenSettings['supabase']>>)
        .optional(),
    translations: z
        .strictObject({
            base_locale: nonemptyString
                .default(SETTING_DECLARATIONS['translations.base_locale'].default)
                .meta(SETTING_DECLARATIONS['translations.base_locale']),
            messages_folder: relativePath.optional().meta(SETTING_DECLARATIONS['translations.messages_folder']),
        } satisfies SchemaShape<TableSettings<'translations'>, NonNullable<WrittenSettings['translations']>>)
        .optional(),
    swift: z
        .strictObject({
            xcode_project: relativePath.optional().meta(SETTING_DECLARATIONS['swift.xcode_project']),
            xcode_scheme: nonemptyString.optional().meta(SETTING_DECLARATIONS['swift.xcode_scheme']),
            xcode_destination: nonemptyString
                .default(SETTING_DECLARATIONS['swift.xcode_destination'].default)
                .meta(SETTING_DECLARATIONS['swift.xcode_destination']),
        } satisfies SchemaShape<TableSettings<'swift'>, NonNullable<WrittenSettings['swift']>>)
        .optional(),
    repository: z
        .strictObject({
            max_file_kilobytes: allowReasonedValue(wholeNumber, SETTING_DECLARATIONS['repository.max_file_kilobytes']),
        } satisfies SchemaShape<TableSettings<'repository'>, NonNullable<WrittenSettings['repository']>>)
        .optional(),
    prose: z
        .strictObject({
            max_sentence_words: allowReasonedValue(wholeNumber, SETTING_DECLARATIONS['prose.max_sentence_words']),
            max_list_item_words: allowReasonedValue(wholeNumber, SETTING_DECLARATIONS['prose.max_list_item_words']),
            max_paragraph_sentences: allowReasonedValue(
                wholeNumber,
                SETTING_DECLARATIONS['prose.max_paragraph_sentences'],
            ),
        } satisfies SchemaShape<TableSettings<'prose'>, NonNullable<WrittenSettings['prose']>>)
        .optional(),
    duplication: z
        .strictObject({
            min_lines: allowReasonedValue(z.number().int().positive(), SETTING_DECLARATIONS['duplication.min_lines']),
            min_tokens: allowReasonedValue(z.number().int().positive(), SETTING_DECLARATIONS['duplication.min_tokens']),
        } satisfies SchemaShape<TableSettings<'duplication'>, NonNullable<WrittenSettings['duplication']>>)
        .optional(),
    xcode: z
        .strictObject({
            allowed_entitlements: z
                .array(z.string())
                .default(SETTING_DECLARATIONS['xcode.allowed_entitlements'].default)
                .meta(SETTING_DECLARATIONS['xcode.allowed_entitlements']),
        } satisfies SchemaShape<TableSettings<'xcode'>, NonNullable<WrittenSettings['xcode']>>)
        .optional(),
};

const toolTableSchemas = Object.fromEntries<z.ZodType>(
    Object.entries(toolsSchema.shape).map(([tool, schema]) => [`tools.${tool}`, schema]),
) as ToolTableSchemas;

const tableValuesSchema = z
    .strictObject({
        ...configurationTableSchemas,
        format: formatSchema.prefault({}),
        ...toolTableSchemas,
    })
    .transform(stripUndefined) satisfies z.ZodType<TableValues>;

/** The [hooks], [ci], and [rules] fields as dotted settings; fields without defaults allow omission. */
const tableSettingSchemas = Object.fromEntries(
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

export { tableValuesSchema, tableSettingSchemas, configurationTableSchemas };
