import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { buildAssetPath } from '#cli/system/assets.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { TableSettings } from '#cli/types/settings/file.ts';
import { nonemptyString } from '#cli/schemas/configurations/fields.ts';
import { stylelintRules } from '#cli/schemas/settings/tools/stylelint.ts';
import { nameListSchema } from '#cli/schemas/configurations/name-lists.ts';
import { buildRuleTableSchema } from '#cli/schemas/settings/tools/rules.ts';
import type { ParsedTools, WrittenTools } from '#cli/types/settings/tools.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { eslintRules, eslintPluginsSchema } from '#cli/schemas/settings/tools/eslint.ts';
import { COMMITLINT_RULES } from '#cli/config/generation/configurations/general/commits.ts';
import { YAMLLINT_RULES } from '#cli/config/generation/configurations/general/data-files.ts';
import { relativePath, nonemptyPaths, nonemptyStrings, allowReasonedValue } from '#cli/schemas/settings/fields.ts';

import {
    RULE_CONDITIONS,
    TRIVY_SEVERITIES,
    SQLFLUFF_DIALECTS,
    KNIP_PACKAGE_NAME,
    MARKDOWNLINT_RULE_ID,
    DOCSTRING_CONVENTIONS,
    IMPORT_EXTENSION_STYLES,
    ESLINT_GLOBAL_NAMES_FILE,
    MARKDOWNLINT_RULE_ID_REFUSAL,
} from '#cli/config/settings/tools/tables.ts';

const eslintGlobalNames = readFileSync(buildAssetPath(ESLINT_GLOBAL_NAMES_FILE), 'utf8');
const ESLINT_RUNTIMES = nameListSchema.parse(JSON.parse(eslintGlobalNames)).names;

const commitlintRuleNames = [...Object.keys(COMMITLINT_RULES), 'type-enum', 'scope-enum'];
const commitlintValuesSchema = z.record(
    z.string().refine((name) => commitlintRuleNames.includes(name), {
        error: `Unknown commitlint rule. Accepted rules: ${commitlintRuleNames.join(', ')}.`,
    }),
    z.tuple([z.enum(RULE_CONDITIONS), z.json().optional()]),
) satisfies z.ZodType<TableSettings<'tools.commitlint'>['rules']>;

const commitlintRules = buildRuleTableSchema(commitlintValuesSchema, 'commits/commitlint') satisfies z.ZodType<
    TableSettings<'tools.commitlint'>['rules']
>;

const yamlOptions = z
    .object({
        level: z.literal('error').optional(),
        ignore: z.never().optional(),
        'ignore-from-file': z.never().optional(),
    } satisfies SchemaShape<
        Omit<NonNullable<NonNullable<NonNullable<WrittenTools['yamllint']>['rules']>['indentation']>, 'spaces'>
    >)
    .catchall(z.json());
const yamlIndentationSchema = yamlOptions.extend({ spaces: z.literal('consistent').optional() }) satisfies z.ZodType<
    NonNullable<NonNullable<WrittenTools['yamllint']>['rules']>['indentation']
>;
const yamlRuleNameSchema = z.string().refine((name) => (YAMLLINT_RULES as readonly string[]).includes(name), {
    error: `Unknown yamllint rule. Accepted rules: ${YAMLLINT_RULES.join(', ')}.`,
}) satisfies z.ZodType<string>;

const yamlRules = buildRuleTableSchema(
    z
        .object({ indentation: yamlIndentationSchema.optional() })
        .catchall(yamlOptions)
        .pipe(z.record(yamlRuleNameSchema, yamlOptions))
        .meta({ type: 'object' }),
    'data-files/yamllint',
);

const eslintTable = z.strictObject({
    import_extension: z
        .enum(IMPORT_EXTENSION_STYLES)
        .default(SETTING_DEFINITIONS['tools.eslint.import_extension'].default)
        .meta(SETTING_DEFINITIONS['tools.eslint.import_extension']),
    restricted_imports: z
        .strictObject({
            name: z.string().meta(SETTING_DEFINITIONS['tools.eslint.restricted_imports.name']),
            message: z.string().meta(SETTING_DEFINITIONS['tools.eslint.restricted_imports.message']),
        } satisfies SchemaShape<TableSettings<'tools.eslint'>['restricted_imports'][number]>)
        .array()
        .default(SETTING_DEFINITIONS['tools.eslint.restricted_imports'].default)
        .meta(SETTING_DEFINITIONS['tools.eslint.restricted_imports']),
    rules: eslintRules
        .default(SETTING_DEFINITIONS['tools.eslint.rules'].default)
        .meta(SETTING_DEFINITIONS['tools.eslint.rules']),
    override: z
        .strictObject({
            paths: nonemptyPaths.describe(SETTING_DEFINITIONS['tools.eslint.override.paths'].description),
            rules: eslintRules.optional().describe(SETTING_DEFINITIONS['tools.eslint.override.rules'].description),
            runtime: z
                .enum(ESLINT_RUNTIMES)
                .optional()
                .describe(SETTING_DEFINITIONS['tools.eslint.override.runtime'].description),
        } satisfies SchemaShape<NonNullable<NonNullable<WrittenTools['eslint']>['override']>[number]>)
        .array()
        .default(SETTING_DEFINITIONS['tools.eslint.override'].default)
        .meta(SETTING_DEFINITIONS['tools.eslint.override']),
    plugins: eslintPluginsSchema,
} satisfies SchemaShape<TableSettings<'tools.eslint'>, NonNullable<WrittenTools['eslint']>>);
const markdownlintOptionsSchema = z.record(z.string(), z.json()) satisfies z.ZodType<
    TableSettings<'tools.markdownlint'>['rules'][string]
>;

const markdownlintRulesSchema = buildRuleTableSchema(
    z.record(
        z.string().regex(MARKDOWNLINT_RULE_ID, { error: MARKDOWNLINT_RULE_ID_REFUSAL }),
        markdownlintOptionsSchema,
    ),
    'markdown/markdownlint',
) satisfies z.ZodType<TableSettings<'tools.markdownlint'>['rules']>;

const markdownlintSchema = z.strictObject({
    rules: markdownlintRulesSchema
        .default(SETTING_DEFINITIONS['tools.markdownlint.rules'].default)
        .meta(SETTING_DEFINITIONS['tools.markdownlint.rules']),
} satisfies SchemaShape<TableSettings<'tools.markdownlint'>, NonNullable<WrittenTools['markdownlint']>>);

const knipSchema = z.strictObject({
    entry: relativePath
        .array()
        .default(SETTING_DEFINITIONS['tools.knip.entry'].default)
        .meta(SETTING_DEFINITIONS['tools.knip.entry']),
    ignore_dependencies: allowReasonedValue(
        z.string().min(1).regex(KNIP_PACKAGE_NAME, 'Use an exact package name, without a regular expression.').array(),
        SETTING_DEFINITIONS['tools.knip.ignore_dependencies'],
    ),
} satisfies SchemaShape<TableSettings<'tools.knip'>, NonNullable<WrittenTools['knip']>>);

const validationTargetSchema = z.strictObject({
    paths: nonemptyPaths.describe(SETTING_DEFINITIONS['tools.v8r.schema.paths'].description),
    url: z.url().describe(SETTING_DEFINITIONS['tools.v8r.schema.url'].description),
} satisfies SchemaShape<TableSettings<'tools.v8r'>['schema'][number]>);

export const toolsSchema = z.strictObject({
    hadolint: z
        .strictObject({
            trusted_registries: z
                .string()
                .array()
                .default(SETTING_DEFINITIONS['tools.hadolint.trusted_registries'].default)
                .meta(SETTING_DEFINITIONS['tools.hadolint.trusted_registries']),
        } satisfies SchemaShape<TableSettings<'tools.hadolint'>, NonNullable<WrittenTools['hadolint']>>)
        .optional(),
    nginx: z
        .strictObject({
            image: nonemptyString
                .default(SETTING_DEFINITIONS['tools.nginx.image'].default)
                .meta(SETTING_DEFINITIONS['tools.nginx.image']),
        } satisfies SchemaShape<TableSettings<'tools.nginx'>, NonNullable<WrittenTools['nginx']>>)
        .optional(),
    ruff: z
        .strictObject({
            docstring_convention: z
                .enum(DOCSTRING_CONVENTIONS)
                .optional()
                .meta(SETTING_DEFINITIONS['tools.ruff.docstring_convention']),
        } satisfies SchemaShape<TableSettings<'tools.ruff'>, NonNullable<WrittenTools['ruff']>>)
        .optional(),
    semgrep: z
        .strictObject({
            registry_packs: z
                .string()
                .array()
                .default(SETTING_DEFINITIONS['tools.semgrep.registry_packs'].default)
                .meta(SETTING_DEFINITIONS['tools.semgrep.registry_packs']),
            rule_files: relativePath
                .array()
                .default(SETTING_DEFINITIONS['tools.semgrep.rule_files'].default)
                .meta(SETTING_DEFINITIONS['tools.semgrep.rule_files']),
        } satisfies SchemaShape<TableSettings<'tools.semgrep'>, NonNullable<WrittenTools['semgrep']>>)
        .optional(),
    sqlfluff: z
        .strictObject({
            dialect: z
                .enum(SQLFLUFF_DIALECTS)
                .default(SETTING_DEFINITIONS['tools.sqlfluff.dialect'].default)
                .meta(SETTING_DEFINITIONS['tools.sqlfluff.dialect']),
        } satisfies SchemaShape<TableSettings<'tools.sqlfluff'>, NonNullable<WrittenTools['sqlfluff']>>)
        .optional(),
    swiftlint: z
        .strictObject({
            always_keep_imports: z
                .string()
                .array()
                .default(SETTING_DEFINITIONS['tools.swiftlint.always_keep_imports'].default)
                .meta(SETTING_DEFINITIONS['tools.swiftlint.always_keep_imports']),
        } satisfies SchemaShape<TableSettings<'tools.swiftlint'>, NonNullable<WrittenTools['swiftlint']>>)
        .optional(),
    trivy: z
        .strictObject({
            severity: z
                .enum(TRIVY_SEVERITIES)
                .array()
                .default(SETTING_DEFINITIONS['tools.trivy.severity'].default)
                .meta(SETTING_DEFINITIONS['tools.trivy.severity']),
        } satisfies SchemaShape<TableSettings<'tools.trivy'>, NonNullable<WrittenTools['trivy']>>)
        .optional(),
    eslint: eslintTable.optional(),
    commitlint: z
        .strictObject({
            types: nonemptyStrings
                .default(SETTING_DEFINITIONS['tools.commitlint.types'].default)
                .meta(SETTING_DEFINITIONS['tools.commitlint.types']),
            scopes: nonemptyStrings
                .default(SETTING_DEFINITIONS['tools.commitlint.scopes'].default)
                .meta(SETTING_DEFINITIONS['tools.commitlint.scopes']),
            rules: commitlintRules
                .default(SETTING_DEFINITIONS['tools.commitlint.rules'].default)
                .meta(SETTING_DEFINITIONS['tools.commitlint.rules']),
        } satisfies SchemaShape<TableSettings<'tools.commitlint'>, NonNullable<WrittenTools['commitlint']>>)
        .optional(),
    yamllint: z
        .strictObject({
            rules: yamlRules
                .default(SETTING_DEFINITIONS['tools.yamllint.rules'].default)
                .meta(SETTING_DEFINITIONS['tools.yamllint.rules']),
        } satisfies SchemaShape<TableSettings<'tools.yamllint'>, NonNullable<WrittenTools['yamllint']>>)
        .optional(),
    markdownlint: markdownlintSchema.optional(),
    stylelint: z
        .strictObject({
            rules: stylelintRules
                .default(SETTING_DEFINITIONS['tools.stylelint.rules'].default)
                .meta(SETTING_DEFINITIONS['tools.stylelint.rules']),
        } satisfies SchemaShape<TableSettings<'tools.stylelint'>, NonNullable<WrittenTools['stylelint']>>)
        .optional(),
    squawk: z
        .strictObject({
            assume_in_transaction: z
                .boolean()
                .default(SETTING_DEFINITIONS['tools.squawk.assume_in_transaction'].default)
                .meta(SETTING_DEFINITIONS['tools.squawk.assume_in_transaction']),
        } satisfies SchemaShape<TableSettings<'tools.squawk'>, NonNullable<WrittenTools['squawk']>>)
        .optional(),
    knip: knipSchema.optional(),
    purgecss: z
        .strictObject({
            safelist: allowReasonedValue(nonemptyStrings, SETTING_DEFINITIONS['tools.purgecss.safelist']),
        } satisfies SchemaShape<TableSettings<'tools.purgecss'>, NonNullable<WrittenTools['purgecss']>>)
        .optional(),
    v8r: z
        .strictObject({
            schema: validationTargetSchema
                .array()
                .default(SETTING_DEFINITIONS['tools.v8r.schema'].default)
                .meta(SETTING_DEFINITIONS['tools.v8r.schema']),
        } satisfies SchemaShape<TableSettings<'tools.v8r'>, NonNullable<WrittenTools['v8r']>>)
        .optional(),
} satisfies SchemaShape<ParsedTools, WrittenTools>);
