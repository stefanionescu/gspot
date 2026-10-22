import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { buildAssetPath } from '#cli/system/assets.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { SETTING_FACTS } from '#cli/config/settings/facts.ts';
import type { TableSettings } from '#cli/types/settings/file.ts';
import { stylelintRules } from '#cli/schemas/settings/stylelint.ts';
import { nonemptyString } from '#cli/schemas/configurations/parts.ts';
import { ESLINT_RUNTIME_NAMES_FILE } from '#cli/config/configurations.ts';
import { nameListSchema } from '#cli/schemas/configurations/name-lists.ts';
import { buildRuleTableSchema } from '#cli/schemas/settings/rule-options.ts';
import { eslintRules, eslintPluginsSchema } from '#cli/schemas/settings/eslint.ts';
import type { ParsedTools, WrittenTools } from '#cli/types/settings/tool-tables.ts';
import { YAMLLINT_RULES } from '#cli/config/generation/config-files/builders/yamllint.ts';
import { COMMITLINT_RULES } from '#cli/config/generation/config-files/builders/commitlint.ts';
import { relativePath, nonemptyPaths, nonemptyStrings, allowReasonedValue } from '#cli/schemas/settings/parts.ts';

import {
    RULE_CONDITIONS,
    KNIP_PACKAGE_NAME,
    RULE_OPTIONS_REFUSAL,
    DOCSTRING_CONVENTIONS,
    IMPORT_EXTENSION_STYLES,
} from '#cli/config/settings/schema.ts';

const ESLINT_RUNTIMES = nameListSchema.parse(
    JSON.parse(readFileSync(buildAssetPath(ESLINT_RUNTIME_NAMES_FILE), 'utf8')),
).names;

const commitlintRuleNames = [...Object.keys(COMMITLINT_RULES), 'type-enum', 'scope-enum'];
const commitlintRules = buildRuleTableSchema(
    z.record(
        z.string().refine((name) => commitlintRuleNames.includes(name), {
            error: `Unknown commitlint rule. Accepted rules: ${commitlintRuleNames.join(', ')}.`,
        }),
        z.tuple([z.enum(RULE_CONDITIONS), z.json().optional()]),
    ),
    'commits/commitlint',
) satisfies z.ZodType<TableSettings<'tools.commitlint'>['rules']>;

const yamlOptions = z
    .object({
        level: z.literal('error').optional(),
        ignore: z.never().optional(),
        'ignore-from-file': z.never().optional(),
    } satisfies SchemaShape<
        Omit<NonNullable<NonNullable<NonNullable<WrittenTools['yamllint']>['rules']>['indentation']>, 'spaces'>
    >)
    .catchall(z.json());

const yamlRules = buildRuleTableSchema(
    z
        .intersection(
            z
                .object({ indentation: yamlOptions.extend({ spaces: z.literal('consistent').optional() }).optional() })
                .catchall(yamlOptions),
            z.record(
                z.string().refine((name) => (YAMLLINT_RULES as readonly string[]).includes(name), {
                    error: `Unknown yamllint rule. Accepted rules: ${YAMLLINT_RULES.join(', ')}.`,
                }),
                z.unknown(),
            ),
        )
        .meta({ type: 'object' }),
    'data-files/yamllint',
);

const eslintTable = z.strictObject({
    import_extension: z
        .enum(IMPORT_EXTENSION_STYLES)
        .default(SETTING_FACTS['tools.eslint.import_extension'].default)
        .meta(SETTING_FACTS['tools.eslint.import_extension']),
    restricted_imports: z
        .array(
            z.strictObject({
                name: z.string().meta(SETTING_FACTS['tools.eslint.restricted_imports.name']),
                message: z.string().meta(SETTING_FACTS['tools.eslint.restricted_imports.message']),
            } satisfies SchemaShape<TableSettings<'tools.eslint'>['restricted_imports'][number]>),
        )
        .default(SETTING_FACTS['tools.eslint.restricted_imports'].default)
        .meta(SETTING_FACTS['tools.eslint.restricted_imports']),
    rules: eslintRules.default(SETTING_FACTS['tools.eslint.rules'].default).meta(SETTING_FACTS['tools.eslint.rules']),
    override: z
        .array(
            z.strictObject({
                paths: nonemptyPaths.describe(SETTING_FACTS['tools.eslint.override.paths'].description),
                rules: eslintRules.optional().describe(SETTING_FACTS['tools.eslint.override.rules'].description),
                runtime: z
                    .enum(ESLINT_RUNTIMES)
                    .optional()
                    .describe(SETTING_FACTS['tools.eslint.override.runtime'].description),
            } satisfies SchemaShape<NonNullable<NonNullable<WrittenTools['eslint']>['override']>[number]>),
        )
        .default(SETTING_FACTS['tools.eslint.override'].default)
        .meta(SETTING_FACTS['tools.eslint.override']),
    plugins: eslintPluginsSchema,
} satisfies SchemaShape<TableSettings<'tools.eslint'>, NonNullable<WrittenTools['eslint']>>);

export const toolsSchema = z.strictObject({
    hadolint: z
        .strictObject({
            trusted_registries: z
                .array(z.string())
                .default(SETTING_FACTS['tools.hadolint.trusted_registries'].default)
                .meta(SETTING_FACTS['tools.hadolint.trusted_registries']),
        } satisfies SchemaShape<TableSettings<'tools.hadolint'>, NonNullable<WrittenTools['hadolint']>>)
        .optional(),
    nginx: z
        .strictObject({
            image: nonemptyString
                .default(SETTING_FACTS['tools.nginx.image'].default)
                .meta(SETTING_FACTS['tools.nginx.image']),
        } satisfies SchemaShape<TableSettings<'tools.nginx'>, NonNullable<WrittenTools['nginx']>>)
        .optional(),
    ruff: z
        .strictObject({
            docstring_convention: z
                .enum(DOCSTRING_CONVENTIONS)
                .optional()
                .meta(SETTING_FACTS['tools.ruff.docstring_convention']),
        } satisfies SchemaShape<TableSettings<'tools.ruff'>, NonNullable<WrittenTools['ruff']>>)
        .optional(),
    semgrep: z
        .strictObject({
            registry_packs: z
                .array(z.string())
                .default(SETTING_FACTS['tools.semgrep.registry_packs'].default)
                .meta(SETTING_FACTS['tools.semgrep.registry_packs']),
            rule_files: z
                .array(relativePath)
                .default(SETTING_FACTS['tools.semgrep.rule_files'].default)
                .meta(SETTING_FACTS['tools.semgrep.rule_files']),
        } satisfies SchemaShape<TableSettings<'tools.semgrep'>, NonNullable<WrittenTools['semgrep']>>)
        .optional(),
    sqlfluff: z
        .strictObject({
            dialect: z
                .string()
                .regex(/^[a-z][a-z0-9_]*$/u)
                .default(SETTING_FACTS['tools.sqlfluff.dialect'].default)
                .meta(SETTING_FACTS['tools.sqlfluff.dialect']),
        } satisfies SchemaShape<TableSettings<'tools.sqlfluff'>, NonNullable<WrittenTools['sqlfluff']>>)
        .optional(),
    swiftlint: z
        .strictObject({
            always_keep_imports: z
                .array(z.string())
                .default(SETTING_FACTS['tools.swiftlint.always_keep_imports'].default)
                .meta(SETTING_FACTS['tools.swiftlint.always_keep_imports']),
        } satisfies SchemaShape<TableSettings<'tools.swiftlint'>, NonNullable<WrittenTools['swiftlint']>>)
        .optional(),
    trivy: z
        .strictObject({
            severity: z
                .array(z.string())
                .default(SETTING_FACTS['tools.trivy.severity'].default)
                .meta(SETTING_FACTS['tools.trivy.severity']),
        } satisfies SchemaShape<TableSettings<'tools.trivy'>, NonNullable<WrittenTools['trivy']>>)
        .optional(),
    eslint: eslintTable.optional(),
    commitlint: z
        .strictObject({
            types: nonemptyStrings
                .default(SETTING_FACTS['tools.commitlint.types'].default)
                .meta(SETTING_FACTS['tools.commitlint.types']),
            scopes: nonemptyStrings
                .default(SETTING_FACTS['tools.commitlint.scopes'].default)
                .meta(SETTING_FACTS['tools.commitlint.scopes']),
            rules: commitlintRules
                .default(SETTING_FACTS['tools.commitlint.rules'].default)
                .meta(SETTING_FACTS['tools.commitlint.rules']),
        } satisfies SchemaShape<TableSettings<'tools.commitlint'>, NonNullable<WrittenTools['commitlint']>>)
        .optional(),
    yamllint: z
        .strictObject({
            rules: yamlRules
                .default(SETTING_FACTS['tools.yamllint.rules'].default)
                .meta(SETTING_FACTS['tools.yamllint.rules']),
        } satisfies SchemaShape<TableSettings<'tools.yamllint'>, NonNullable<WrittenTools['yamllint']>>)
        .optional(),
    markdownlint: z
        .strictObject({
            rules: buildRuleTableSchema(
                z.record(
                    z.string().regex(/^MD\d{3}$/u, { error: RULE_OPTIONS_REFUSAL }),
                    z.record(z.string(), z.json()),
                ),
                'markdown/markdownlint',
            )
                .default(SETTING_FACTS['tools.markdownlint.rules'].default)
                .meta(SETTING_FACTS['tools.markdownlint.rules']),
        } satisfies SchemaShape<TableSettings<'tools.markdownlint'>, NonNullable<WrittenTools['markdownlint']>>)
        .optional(),
    stylelint: z
        .strictObject({
            rules: stylelintRules
                .default(SETTING_FACTS['tools.stylelint.rules'].default)
                .meta(SETTING_FACTS['tools.stylelint.rules']),
        } satisfies SchemaShape<TableSettings<'tools.stylelint'>, NonNullable<WrittenTools['stylelint']>>)
        .optional(),
    squawk: z
        .strictObject({
            assume_in_transaction: z
                .boolean()
                .default(SETTING_FACTS['tools.squawk.assume_in_transaction'].default)
                .meta(SETTING_FACTS['tools.squawk.assume_in_transaction']),
        } satisfies SchemaShape<TableSettings<'tools.squawk'>, NonNullable<WrittenTools['squawk']>>)
        .optional(),
    knip: z
        .strictObject({
            entry: z
                .array(relativePath)
                .default(SETTING_FACTS['tools.knip.entry'].default)
                .meta(SETTING_FACTS['tools.knip.entry']),
            ignore_dependencies: allowReasonedValue(
                z.array(
                    z
                        .string()
                        .min(1)
                        .regex(KNIP_PACKAGE_NAME, 'Use an exact package name, without a regular expression.'),
                ),
                SETTING_FACTS['tools.knip.ignore_dependencies'],
            ),
        } satisfies SchemaShape<TableSettings<'tools.knip'>, NonNullable<WrittenTools['knip']>>)
        .optional(),
    purgecss: z
        .strictObject({
            safelist: allowReasonedValue(nonemptyStrings, SETTING_FACTS['tools.purgecss.safelist']),
        } satisfies SchemaShape<TableSettings<'tools.purgecss'>, NonNullable<WrittenTools['purgecss']>>)
        .optional(),
    v8r: z
        .strictObject({
            schema: z
                .array(
                    z.strictObject({
                        paths: nonemptyPaths.describe(SETTING_FACTS['tools.v8r.schema.paths'].description),
                        url: z.url().describe(SETTING_FACTS['tools.v8r.schema.url'].description),
                    } satisfies SchemaShape<TableSettings<'tools.v8r'>['schema'][number]>),
                )
                .default(SETTING_FACTS['tools.v8r.schema'].default)
                .meta(SETTING_FACTS['tools.v8r.schema']),
        } satisfies SchemaShape<TableSettings<'tools.v8r'>, NonNullable<WrittenTools['v8r']>>)
        .optional(),
} satisfies SchemaShape<ParsedTools, WrittenTools>);
