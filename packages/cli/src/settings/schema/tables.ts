import { z } from 'zod';
import { compact } from '#cli/objects.ts';
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
    settingField,
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
    banned_words: settingField(z.array(z.string()), [], DEFAULT_FIELDS.banned_words),
    override: settingField(
        z.array(
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
        ),
        [],
        DEFAULT_FIELDS.override,
    ),
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
    allowed: settingField(nonemptyStrings, [], TABLE_FIELDS.allowed),
    allowed_package: settingField(z.array(allowedPackageSchema), [], TABLE_FIELDS.allowed_package),
} satisfies SchemaShape<TableSettings<'licenses'>, WrittenLicenses>);

const configurationTableSchemas = {
    architecture: architectureSchema.optional(),
    format: formatSchema.optional(),
    limits: limitsSchema.optional(),
    naming: namingSchema.optional(),
    structure: z
        .strictObject({
            reexports: settingField(reasonValue(z.enum(REEXPORT_MODES)), 'none', TABLE_FIELDS.reexports),
        } satisfies SchemaShape<TableSettings<'structure'>, NonNullable<WrittenSettings['structure']>>)
        .optional(),
    cloudflare: z
        .strictObject({
            types_file: settingField(destinationPath, 'worker-configuration.d.ts', TABLE_FIELDS.cloudflare_types_file),
            types_interface: settingField(nonemptyString, 'Env', TABLE_FIELDS.types_interface),
        } satisfies SchemaShape<TableSettings<'cloudflare'>, NonNullable<WrittenSettings['cloudflare']>>)
        .optional(),
    coverage: z
        .strictObject({
            lines: settingField(reasonValue(percentage), 0, TABLE_FIELDS.lines),
            branches: settingField(reasonValue(percentage), 0, TABLE_FIELDS.branches),
            functions: settingField(reasonValue(percentage), 0, TABLE_FIELDS.functions),
            statements: settingField(reasonValue(percentage), 0, TABLE_FIELDS.statements),
            target: settingField(
                z.array(
                    z.strictObject({
                        name: nonemptyString.describe(RECORD_DESCRIPTIONS.target_name),
                        lines: percentage.describe(RECORD_DESCRIPTIONS.target_lines),
                        reason: z.string().optional().describe(RECORD_DESCRIPTIONS.target_reason),
                    } satisfies SchemaShape<TableSettings<'coverage'>['target'][number]>),
                ),
                [],
                TABLE_FIELDS.target,
            ),
        } satisfies SchemaShape<TableSettings<'coverage'>, NonNullable<WrittenSettings['coverage']>>)
        .optional(),
    dependencies: z
        .strictObject({
            min_release_age_days: settingField(
                reasonValue(wholeNumber),
                DEFAULT_VALUES.min_release_age_days,
                TABLE_FIELDS.min_release_age_days,
            ),
            allowed_registries: settingField(
                reasonValue(nonemptyStrings),
                ['registry.npmjs.org', 'registry.yarnpkg.com'],
                TABLE_FIELDS.allowed_registries,
            ),
            scanner: nonemptyString.optional().meta(TABLE_FIELDS.scanner),
        } satisfies SchemaShape<TableSettings<'dependencies'>, NonNullable<WrittenSettings['dependencies']>>)
        .optional(),
    docs: z
        .strictObject({
            banned_headings: settingField(z.array(z.string()), [], TABLE_FIELDS.banned_headings),
            allowed_urls: settingField(reasonValue(z.array(z.string())), [], TABLE_FIELDS.allowed_urls),
        } satisfies SchemaShape<TableSettings<'docs'>, NonNullable<WrittenSettings['docs']>>)
        .optional(),
    drizzle: z
        .strictObject({
            client_names: settingField(nonemptyStrings, ['db'], TABLE_FIELDS.client_names),
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
            client_schemas: settingField(nonemptyStrings, [], TABLE_FIELDS.client_schemas),
            frozen_through: settingField(nonemptyString, 'none', TABLE_FIELDS.frozen_through),
            migrations_folder: relativePath.optional().meta(TABLE_FIELDS.migrations_folder),
        } satisfies SchemaShape<TableSettings<'postgres'>, NonNullable<WrittenSettings['postgres']>>)
        .optional(),
    secrets: z
        .strictObject({
            env_examples: settingField(
                nonemptyStrings,
                ['.env.example', '.env.template', '.env.sample', '.dev.vars.example'],
                TABLE_FIELDS.env_examples,
            ),
            reader_functions: settingField(nonemptyStrings, [], TABLE_FIELDS.reader_functions),
        } satisfies SchemaShape<TableSettings<'secrets'>, NonNullable<WrittenSettings['secrets']>>)
        .optional(),
    site: z
        .strictObject({
            build_command: settingField(commandSchema, ['npm', 'run', 'build'], TABLE_FIELDS.build_command),
            build_folder: settingField(destinationPath, 'dist', TABLE_FIELDS.build_folder),
            allowed_unlisted_pages: settingField(
                reasonValue(relativePaths),
                ['404.html'],
                TABLE_FIELDS.allowed_unlisted_pages,
            ),
            size_limit: settingField(
                z.array(
                    z.strictObject({
                        paths: z.array(destinationPath).min(1).describe(RECORD_DESCRIPTIONS.size_paths),
                        kilobytes: wholeNumber.describe(RECORD_DESCRIPTIONS.size_kilobytes),
                    } satisfies SchemaShape<TableSettings<'site'>['size_limit'][number]>),
                ),
                [],
                TABLE_FIELDS.size_limit,
            ),
        } satisfies SchemaShape<TableSettings<'site'>, NonNullable<WrittenSettings['site']>>)
        .optional(),
    spelling: z
        .strictObject({
            locale: settingField(z.enum(SPELLING_LOCALES), 'en-us', TABLE_FIELDS.locale),
        } satisfies SchemaShape<TableSettings<'spelling'>, NonNullable<WrittenSettings['spelling']>>)
        .optional(),
    supabase: z
        .strictObject({
            functions_folder: settingField(relativePath, 'supabase/functions', TABLE_FIELDS.functions_folder),
            schemas: settingField(nonemptyStrings, ['public'], TABLE_FIELDS.schemas),
            types_file: destinationPath.optional().meta(TABLE_FIELDS.supabase_types_file),
        } satisfies SchemaShape<TableSettings<'supabase'>, NonNullable<WrittenSettings['supabase']>>)
        .optional(),
    translations: z
        .strictObject({
            base_locale: settingField(nonemptyString, 'en', TABLE_FIELDS.base_locale),
            messages_folder: relativePath.optional().meta(TABLE_FIELDS.messages_folder),
        } satisfies SchemaShape<TableSettings<'translations'>, NonNullable<WrittenSettings['translations']>>)
        .optional(),
    xcode: z
        .strictObject({
            project: relativePath.optional().meta(DEFAULT_FIELDS.project),
            scheme: nonemptyString.optional().meta(DEFAULT_FIELDS.scheme),
            destination: settingField(nonemptyString, 'generic/platform=iOS Simulator', DEFAULT_FIELDS.destination),
            allowed_entitlements: settingField(z.array(z.string()), [], DEFAULT_FIELDS.allowed_entitlements),
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
    .transform(compact) satisfies z.ZodType<TableValues>;

export { limitsSchema, namingSchema, tableValuesSchema, configurationTableSchemas };
