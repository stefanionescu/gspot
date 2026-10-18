import { z } from 'zod';
import { stripUndefined } from '#cli/system/values.ts';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { toolsSchema } from '#cli/settings/schema/tools.ts';
import { limitsSchema } from '#cli/settings/schema/limits.ts';
import { namingSchema } from '#cli/settings/schema/naming.ts';
import { licensesSchema } from '#cli/settings/schema/licenses.ts';
import { type WrittenSettings } from '#cli/types/settings/file.ts';
import { SETTING_DEFAULTS } from '#cli/config/settings/defaults.ts';
import { commandSchema } from '#cli/configurations/schema/parts.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { REEXPORT_MODES, SPELLING_LOCALES } from '#cli/config/settings/schema.ts';
import { type TableValues, type TableSettings } from '#cli/types/settings/tables.ts';
import { ciFields, hooksSchema, rulesSchema } from '#cli/settings/schema/integrations.ts';

import {
    percentage,
    wholeNumber,
    formatSchema,
    relativePath,
    nonemptyString,
    nonemptyStrings,
    destinationPath,
    allowReasonedValue,
} from '#cli/settings/schema/parts.ts';

const configurationTableSchemas = {
    format: formatSchema.optional(),
    limits: limitsSchema.optional(),
    naming: namingSchema.optional(),
    structure: z
        .strictObject({
            reexports: allowReasonedValue(z.enum(REEXPORT_MODES), 'none', SETTING_DECLARATIONS['structure.reexports']),
            environment_readers: z
                .array(relativePath)
                .default([])
                .meta({
                    configurations: ['structure'],
                    description: 'The files that may read environment variables; other files get the values passed in.',
                }),
        } satisfies SchemaShape<TableSettings<'structure'>, NonNullable<WrittenSettings['structure']>>)
        .optional(),
    cloudflare: z
        .strictObject({
            types_file: destinationPath
                .default('worker-configuration.d.ts')
                .meta(SETTING_DECLARATIONS['cloudflare.types_file']),
            types_interface: nonemptyString.default('Env').meta(SETTING_DECLARATIONS['cloudflare.types_interface']),
        } satisfies SchemaShape<TableSettings<'cloudflare'>, NonNullable<WrittenSettings['cloudflare']>>)
        .optional(),
    coverage: z
        .strictObject({
            lines: allowReasonedValue(percentage, 0, SETTING_DECLARATIONS['coverage.lines']),
            branches: allowReasonedValue(percentage, 0, SETTING_DECLARATIONS['coverage.branches']),
            functions: allowReasonedValue(percentage, 0, SETTING_DECLARATIONS['coverage.functions']),
            statements: allowReasonedValue(percentage, 0, SETTING_DECLARATIONS['coverage.statements']),
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
                .default([])
                .meta(SETTING_DECLARATIONS['coverage.swift_target']),
        } satisfies SchemaShape<TableSettings<'coverage'>, NonNullable<WrittenSettings['coverage']>>)
        .optional(),
    dependencies: z
        .strictObject({
            min_release_age_days: allowReasonedValue(
                wholeNumber,
                SETTING_DEFAULTS.min_release_age_days,
                SETTING_DECLARATIONS['dependencies.min_release_age_days'],
            ),
            allowed_registries: allowReasonedValue(
                nonemptyStrings,
                ['registry.npmjs.org', 'registry.yarnpkg.com'],
                SETTING_DECLARATIONS['dependencies.allowed_registries'],
            ),
            bun_scanner: nonemptyString.optional().meta(SETTING_DECLARATIONS['dependencies.bun_scanner']),
        } satisfies SchemaShape<TableSettings<'dependencies'>, NonNullable<WrittenSettings['dependencies']>>)
        .optional(),
    docs: z
        .strictObject({
            banned_headings: z.array(z.string()).default([]).meta(SETTING_DECLARATIONS['docs.banned_headings']),
            allowed_urls: allowReasonedValue(z.array(z.string()), [], SETTING_DECLARATIONS['docs.allowed_urls']),
        } satisfies SchemaShape<TableSettings<'docs'>, NonNullable<WrittenSettings['docs']>>)
        .optional(),
    drizzle: z
        .strictObject({
            client_names: nonemptyStrings.default(['db']).meta(SETTING_DECLARATIONS['drizzle.client_names']),
        } satisfies SchemaShape<TableSettings<'drizzle'>, NonNullable<WrittenSettings['drizzle']>>)
        .optional(),
    javascript: z
        .strictObject({
            script_files: z
                .array(relativePath)
                .default(['scripts/**', '**/*.config.{js,mjs,cjs,ts}'])
                .meta({
                    configurations: ['javascript'],
                    description: 'Script files, which may print to the console and call process.exit.',
                }),
        } satisfies SchemaShape<TableSettings<'javascript'>, NonNullable<WrittenSettings['javascript']>>)
        .optional(),
    trpc: z
        .strictObject({
            router_files: z
                .array(relativePath)
                .default(['**/routers/**', '**/*router*.ts', '**/trpc/**'])
                .meta({ configurations: ['trpc'], description: 'The files that declare tRPC procedures.' }),
            server_files: z
                .array(relativePath)
                .default([])
                .meta({
                    configurations: ['trpc'],
                    description:
                        'The server files that other files of a tRPC scope may import only as types; empty turns the rule off.',
                }),
        } satisfies SchemaShape<TableSettings<'trpc'>, NonNullable<WrittenSettings['trpc']>>)
        .optional(),
    zustand: z
        .strictObject({
            store_files: z
                .array(relativePath)
                .default(['**/store.*', '**/stores/*', '**/store/*', '**/*.store.*'])
                .meta({ configurations: ['zustand'], description: 'The files that may create a store.' }),
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
            client_schemas: nonemptyStrings.default([]).meta(SETTING_DECLARATIONS['postgres.client_schemas']),
            frozen_through: nonemptyString.default('none').meta(SETTING_DECLARATIONS['postgres.frozen_through']),
            migrations_folder: relativePath.optional().meta(SETTING_DECLARATIONS['postgres.migrations_folder']),
        } satisfies SchemaShape<TableSettings<'postgres'>, NonNullable<WrittenSettings['postgres']>>)
        .optional(),
    secrets: z
        .strictObject({
            env_examples: nonemptyStrings
                .default(['.env.example', '.env.template', '.env.sample', '.dev.vars.example'])
                .meta(SETTING_DECLARATIONS['secrets.env_examples']),
            environment_functions: nonemptyStrings
                .default([])
                .meta(SETTING_DECLARATIONS['secrets.environment_functions']),
        } satisfies SchemaShape<TableSettings<'secrets'>, NonNullable<WrittenSettings['secrets']>>)
        .optional(),
    site: z
        .strictObject({
            build_command: commandSchema
                .default(['npm', 'run', 'build'])
                .meta(SETTING_DECLARATIONS['site.build_command']),
            build_folder: destinationPath.default('dist').meta(SETTING_DECLARATIONS['site.build_folder']),
            allowed_unlisted_pages: allowReasonedValue(
                z.array(relativePath.meta({ pathRole: 'build' })),
                ['404.html'],
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
                .default([])
                .meta(SETTING_DECLARATIONS['site.size_limit']),
        } satisfies SchemaShape<TableSettings<'site'>, NonNullable<WrittenSettings['site']>>)
        .optional(),
    spelling: z
        .strictObject({
            locale: z.enum(SPELLING_LOCALES).default('en-us').meta(SETTING_DECLARATIONS['spelling.locale']),
        } satisfies SchemaShape<TableSettings<'spelling'>, NonNullable<WrittenSettings['spelling']>>)
        .optional(),
    supabase: z
        .strictObject({
            functions_folder: relativePath
                .default('supabase/functions')
                .meta(SETTING_DECLARATIONS['supabase.functions_folder']),
            schemas: nonemptyStrings.default(['public']).meta(SETTING_DECLARATIONS['supabase.schemas']),
            types_file: destinationPath.optional().meta(SETTING_DECLARATIONS['supabase.types_file']),
        } satisfies SchemaShape<TableSettings<'supabase'>, NonNullable<WrittenSettings['supabase']>>)
        .optional(),
    translations: z
        .strictObject({
            base_locale: nonemptyString.default('en').meta(SETTING_DECLARATIONS['translations.base_locale']),
            messages_folder: relativePath.optional().meta(SETTING_DECLARATIONS['translations.messages_folder']),
        } satisfies SchemaShape<TableSettings<'translations'>, NonNullable<WrittenSettings['translations']>>)
        .optional(),
    swift: z
        .strictObject({
            xcode_project: relativePath.optional().meta(SETTING_DECLARATIONS['swift.xcode_project']),
            xcode_scheme: nonemptyString.optional().meta(SETTING_DECLARATIONS['swift.xcode_scheme']),
            xcode_destination: nonemptyString
                .default('generic/platform=iOS Simulator')
                .meta(SETTING_DECLARATIONS['swift.xcode_destination']),
        } satisfies SchemaShape<TableSettings<'swift'>, NonNullable<WrittenSettings['swift']>>)
        .optional(),
    repository: z
        .strictObject({
            max_file_kilobytes: allowReasonedValue(
                wholeNumber,
                SETTING_DEFAULTS.max_file_kilobytes,
                SETTING_DECLARATIONS['repository.max_file_kilobytes'],
            ),
        } satisfies SchemaShape<TableSettings<'repository'>, NonNullable<WrittenSettings['repository']>>)
        .optional(),
    prose: z
        .strictObject({
            max_sentence_words: allowReasonedValue(
                wholeNumber,
                SETTING_DEFAULTS.max_sentence_words,
                SETTING_DECLARATIONS['prose.max_sentence_words'],
            ),
            max_list_item_words: allowReasonedValue(
                wholeNumber,
                SETTING_DEFAULTS.max_list_item_words,
                SETTING_DECLARATIONS['prose.max_list_item_words'],
            ),
            max_paragraph_sentences: allowReasonedValue(
                wholeNumber,
                SETTING_DEFAULTS.max_paragraph_sentences,
                SETTING_DECLARATIONS['prose.max_paragraph_sentences'],
            ),
        } satisfies SchemaShape<TableSettings<'prose'>, NonNullable<WrittenSettings['prose']>>)
        .optional(),
    duplication: z
        .strictObject({
            min_lines: allowReasonedValue(
                z.number().int().positive(),
                SETTING_DEFAULTS.min_lines,
                SETTING_DECLARATIONS['duplication.min_lines'],
            ),
            min_tokens: allowReasonedValue(
                z.number().int().positive(),
                SETTING_DEFAULTS.min_tokens,
                SETTING_DECLARATIONS['duplication.min_tokens'],
            ),
        } satisfies SchemaShape<TableSettings<'duplication'>, NonNullable<WrittenSettings['duplication']>>)
        .optional(),
    xcode: z
        .strictObject({
            allowed_entitlements: z
                .array(z.string())
                .default([])
                .meta(SETTING_DECLARATIONS['xcode.allowed_entitlements']),
        } satisfies SchemaShape<TableSettings<'xcode'>, NonNullable<WrittenSettings['xcode']>>)
        .optional(),
};

const tableValuesSchema = z
    .strictObject({
        ...configurationTableSchemas,
        format: formatSchema.prefault({}),
        'tools.commitlint': toolsSchema.shape['commitlint'],
        'tools.editorconfig-checker': toolsSchema.shape['editorconfig-checker'],
        'tools.eslint': toolsSchema.shape['eslint'],
        'tools.hadolint': toolsSchema.shape['hadolint'],
        'tools.knip': toolsSchema.shape['knip'],
        'tools.markdownlint': toolsSchema.shape['markdownlint'],
        'tools.nginx': toolsSchema.shape['nginx'],
        'tools.prettier': toolsSchema.shape['prettier'],
        'tools.purgecss': toolsSchema.shape['purgecss'],
        'tools.ruff': toolsSchema.shape['ruff'],
        'tools.semgrep': toolsSchema.shape['semgrep'],
        'tools.shellcheck': toolsSchema.shape['shellcheck'],
        'tools.sqlfluff': toolsSchema.shape['sqlfluff'],
        'tools.squawk': toolsSchema.shape['squawk'],
        'tools.stylelint': toolsSchema.shape['stylelint'],
        'tools.swiftlint': toolsSchema.shape['swiftlint'],
        'tools.taplo': toolsSchema.shape['taplo'],
        'tools.trivy': toolsSchema.shape['trivy'],
        'tools.typos': toolsSchema.shape['typos'],
        'tools.v8r': toolsSchema.shape['v8r'],
        'tools.yamllint': toolsSchema.shape['yamllint'],
    } satisfies SchemaShape<TableValues>)
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
