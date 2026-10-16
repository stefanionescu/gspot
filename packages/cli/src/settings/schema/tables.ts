import { z } from 'zod';
import { stripUndefined } from '#cli/system/values.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { toolsSchema } from '#cli/settings/schema/tools.ts';
import { TABLE_FIELDS } from '#cli/config/settings/values.ts';
import { limitFields } from '#cli/settings/schema/limit-fields.ts';
import { commandSchema } from '#cli/configurations/schema/parts.ts';
import { architectureSchema } from '#cli/settings/schema/architecture.ts';
import { namingOverrideSchema } from '#cli/configurations/schema/naming.ts';
import { REEXPORT_MODES, SPELLING_LOCALES, SETTING_LANGUAGES } from '#cli/config/settings/schema.ts';
import { DEFAULT_VALUES, DEFAULT_FIELDS, RECORD_DESCRIPTIONS } from '#cli/config/settings/defaults.ts';
import type { TableValues, TableSettings, NamingCategory, NamingLanguage } from '#cli/types/settings/tables.ts';

import type {
    WrittenLimits,
    WrittenNaming,
    WrittenLicenses,
    WrittenSettings,
    ParsedNamingOverride,
    WrittenNamingOverride,
} from '#cli/types/settings/file.ts';
import {
    percentage,
    wholeNumber,
    reasonValue,
    formatSchema,
    relativePath,
    relativePaths,
    nonemptyPaths,
    nonemptyString,
    nonemptyStrings,
    destinationPath,
    namingCategorySchema,
} from '#cli/settings/schema/parts.ts';

const languageLimitsSchema = z.strictObject(limitFields);
const limitsSchema = z.strictObject({
    ...limitFields,
    typescript: languageLimitsSchema.optional(),
    javascript: languageLimitsSchema.optional(),
    python: languageLimitsSchema.optional(),
    bash: languageLimitsSchema.optional(),
    swift: languageLimitsSchema.optional(),
    sql: languageLimitsSchema.optional(),
    css: languageLimitsSchema.optional(),
    html: languageLimitsSchema.optional(),
} satisfies SchemaShape<TableSettings<'limits'>, WrittenLimits>);

const namingLanguageSchema = namingCategorySchema.extend({
    files: namingCategorySchema.optional(),
    directories: namingCategorySchema.optional(),
    types: namingCategorySchema.optional(),
    functions: namingCategorySchema.optional(),
    parameters: namingCategorySchema.optional(),
    variables: namingCategorySchema.optional(),
    properties: namingCategorySchema.optional(),
} satisfies SchemaShape<
    Pick<NonNullable<TableSettings<'naming'>[NamingLanguage]>, NamingCategory>,
    Pick<NonNullable<WrittenNaming[NamingLanguage]>, NamingCategory>
>);
const namingLists = {
    banned_words: z.array(z.string()).default([]).meta(DEFAULT_FIELDS.banned_words),
    override: z
        .array(
            namingOverrideSchema.extend({
                paths: nonemptyPaths.default(['**']).describe(namingOverrideSchema.shape.paths.description as string),
                languages: z
                    .array(z.enum(SETTING_LANGUAGES))
                    .optional()
                    .describe(namingOverrideSchema.shape.languages.description as string),
                allow_digits: namingOverrideSchema.shape.allow_digits.default(false),
                allow_repeated_words: namingOverrideSchema.shape.allow_repeated_words.default(false),
                reason: z.string().describe(namingOverrideSchema.shape.reason.description as string),
            } satisfies SchemaShape<
                Pick<ParsedNamingOverride, 'paths' | 'languages' | 'allow_digits' | 'allow_repeated_words' | 'reason'>,
                Pick<WrittenNamingOverride, 'paths' | 'languages' | 'allow_digits' | 'allow_repeated_words' | 'reason'>
            >),
        )
        .default([])
        .meta(DEFAULT_FIELDS.override),
};

const namingSchema = z.strictObject({
    ...namingCategorySchema.shape,
    ...namingLists,
    typescript: namingLanguageSchema.optional(),
    javascript: namingLanguageSchema.optional(),
    python: namingLanguageSchema.optional(),
    bash: namingLanguageSchema.optional(),
    swift: namingLanguageSchema.optional(),
    sql: namingLanguageSchema.optional(),
    css: namingLanguageSchema.optional(),
    html: namingLanguageSchema.optional(),
} satisfies SchemaShape<TableSettings<'naming'>, WrittenNaming>);

const allowedPackageSchema = z.strictObject({
    name: nonemptyString.describe(RECORD_DESCRIPTIONS.package_name),
    version: z
        .string()
        .regex(/^\d[^\s@<>=~^*|,]*$/u, 'Name an exact package version.')
        .describe(RECORD_DESCRIPTIONS.package_version),
    reason: z.string().describe(RECORD_DESCRIPTIONS.package_reason),
} satisfies SchemaShape<TableSettings<'licenses'>['allowed_package'][number]>);

const licensesSchema = z.strictObject({
    allowed: nonemptyStrings.default([]).meta(TABLE_FIELDS.allowed),
    allowed_package: z.array(allowedPackageSchema).default([]).meta(TABLE_FIELDS.allowed_package),
} satisfies SchemaShape<TableSettings<'licenses'>, WrittenLicenses>);

const configurationTableSchemas = {
    architecture: architectureSchema.optional(),
    format: formatSchema.optional(),
    limits: limitsSchema.optional(),
    naming: namingSchema.optional(),
    structure: z
        .strictObject({
            reexports: reasonValue(z.enum(REEXPORT_MODES)).default('none').meta(TABLE_FIELDS.reexports),
        } satisfies SchemaShape<TableSettings<'structure'>, NonNullable<WrittenSettings['structure']>>)
        .optional(),
    cloudflare: z
        .strictObject({
            types_file: destinationPath.default('worker-configuration.d.ts').meta(TABLE_FIELDS.cloudflare_types_file),
            types_interface: nonemptyString.default('Env').meta(TABLE_FIELDS.types_interface),
        } satisfies SchemaShape<TableSettings<'cloudflare'>, NonNullable<WrittenSettings['cloudflare']>>)
        .optional(),
    coverage: z
        .strictObject({
            lines: reasonValue(percentage).default(0).meta(TABLE_FIELDS.lines),
            branches: reasonValue(percentage).default(0).meta(TABLE_FIELDS.branches),
            functions: reasonValue(percentage).default(0).meta(TABLE_FIELDS.functions),
            statements: reasonValue(percentage).default(0).meta(TABLE_FIELDS.statements),
            target: z
                .array(
                    z.strictObject({
                        name: nonemptyString.describe(RECORD_DESCRIPTIONS.target_name),
                        lines: percentage.describe(RECORD_DESCRIPTIONS.target_lines),
                        reason: z.string().optional().describe(RECORD_DESCRIPTIONS.target_reason),
                    } satisfies SchemaShape<TableSettings<'coverage'>['target'][number]>),
                )
                .default([])
                .meta(TABLE_FIELDS.target),
        } satisfies SchemaShape<TableSettings<'coverage'>, NonNullable<WrittenSettings['coverage']>>)
        .optional(),
    dependencies: z
        .strictObject({
            min_release_age_days: reasonValue(wholeNumber)
                .default(DEFAULT_VALUES.min_release_age_days)
                .meta(TABLE_FIELDS.min_release_age_days),
            allowed_registries: reasonValue(nonemptyStrings)
                .default(['registry.npmjs.org', 'registry.yarnpkg.com'])
                .meta(TABLE_FIELDS.allowed_registries),
            scanner: nonemptyString.optional().meta(TABLE_FIELDS.scanner),
        } satisfies SchemaShape<TableSettings<'dependencies'>, NonNullable<WrittenSettings['dependencies']>>)
        .optional(),
    docs: z
        .strictObject({
            banned_headings: z.array(z.string()).default([]).meta(TABLE_FIELDS.banned_headings),
            allowed_urls: reasonValue(z.array(z.string())).default([]).meta(TABLE_FIELDS.allowed_urls),
        } satisfies SchemaShape<TableSettings<'docs'>, NonNullable<WrittenSettings['docs']>>)
        .optional(),
    drizzle: z
        .strictObject({
            client_names: nonemptyStrings.default(['db']).meta(TABLE_FIELDS.client_names),
        } satisfies SchemaShape<TableSettings<'drizzle'>, NonNullable<WrittenSettings['drizzle']>>)
        .optional(),
    licenses: licensesSchema.optional(),
    openapi: z
        .strictObject({
            document: relativePath.optional().meta(TABLE_FIELDS.document),
            generate_command: commandSchema.optional().meta(TABLE_FIELDS.generate_command),
        } satisfies SchemaShape<TableSettings<'openapi'>, NonNullable<WrittenSettings['openapi']>>)
        .optional(),
    postgres: z
        .strictObject({
            client_schemas: nonemptyStrings.default([]).meta(TABLE_FIELDS.client_schemas),
            frozen_through: nonemptyString.default('none').meta(TABLE_FIELDS.frozen_through),
            migrations_folder: relativePath.optional().meta(TABLE_FIELDS.migrations_folder),
        } satisfies SchemaShape<TableSettings<'postgres'>, NonNullable<WrittenSettings['postgres']>>)
        .optional(),
    secrets: z
        .strictObject({
            env_examples: nonemptyStrings
                .default(['.env.example', '.env.template', '.env.sample', '.dev.vars.example'])
                .meta(TABLE_FIELDS.env_examples),
            reader_functions: nonemptyStrings.default([]).meta(TABLE_FIELDS.reader_functions),
        } satisfies SchemaShape<TableSettings<'secrets'>, NonNullable<WrittenSettings['secrets']>>)
        .optional(),
    site: z
        .strictObject({
            build_command: commandSchema.default(['npm', 'run', 'build']).meta(TABLE_FIELDS.build_command),
            build_folder: destinationPath.default('dist').meta(TABLE_FIELDS.build_folder),
            allowed_unlisted_pages: reasonValue(relativePaths)
                .default(['404.html'])
                .meta(TABLE_FIELDS.allowed_unlisted_pages),
            size_limit: z
                .array(
                    z.strictObject({
                        paths: z.array(destinationPath).min(1).describe(RECORD_DESCRIPTIONS.size_paths),
                        kilobytes: wholeNumber.describe(RECORD_DESCRIPTIONS.size_kilobytes),
                    } satisfies SchemaShape<TableSettings<'site'>['size_limit'][number]>),
                )
                .default([])
                .meta(TABLE_FIELDS.size_limit),
        } satisfies SchemaShape<TableSettings<'site'>, NonNullable<WrittenSettings['site']>>)
        .optional(),
    spelling: z
        .strictObject({
            locale: z.enum(SPELLING_LOCALES).default('en-us').meta(TABLE_FIELDS.locale),
        } satisfies SchemaShape<TableSettings<'spelling'>, NonNullable<WrittenSettings['spelling']>>)
        .optional(),
    supabase: z
        .strictObject({
            functions_folder: relativePath.default('supabase/functions').meta(TABLE_FIELDS.functions_folder),
            schemas: nonemptyStrings.default(['public']).meta(TABLE_FIELDS.schemas),
            types_file: destinationPath.optional().meta(TABLE_FIELDS.supabase_types_file),
        } satisfies SchemaShape<TableSettings<'supabase'>, NonNullable<WrittenSettings['supabase']>>)
        .optional(),
    translations: z
        .strictObject({
            base_locale: nonemptyString.default('en').meta(TABLE_FIELDS.base_locale),
            messages_folder: relativePath.optional().meta(TABLE_FIELDS.messages_folder),
        } satisfies SchemaShape<TableSettings<'translations'>, NonNullable<WrittenSettings['translations']>>)
        .optional(),
    xcode: z
        .strictObject({
            project: relativePath.optional().meta(DEFAULT_FIELDS.project),
            scheme: nonemptyString.optional().meta(DEFAULT_FIELDS.scheme),
            destination: nonemptyString.default('generic/platform=iOS Simulator').meta(DEFAULT_FIELDS.destination),
            allowed_entitlements: z.array(z.string()).default([]).meta(DEFAULT_FIELDS.allowed_entitlements),
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

export { limitsSchema, namingSchema, tableValuesSchema, configurationTableSchemas };
