import { z } from 'zod';
import { quoteArgument } from '#cli/system/text.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { JsonValue } from '#cli/types/parsers/json.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';
import { RECORD_DESCRIPTIONS } from '#cli/config/settings/defaults.ts';
import type { ToolTable, StylelintOptions } from '#cli/types/settings/file.ts';
import type { ParsedTools, WrittenTools } from '#cli/types/settings/tool-tables.ts';
import { YAMLLINT_RULES, COMMITLINT_RULES } from '#cli/config/generation/tool-file-sources.ts';
import ESLINT_RUNTIMES from '../../../configurations/language/javascript/eslint-runtime-names.json' with { type: 'json' };

import {
    reasonValue,
    relativePath,
    nonemptyPaths,
    nonemptyString,
    nonemptyStrings,
    reasonEnvelopeSchema,
} from '#cli/settings/schema/parts.ts';
import {
    RULE_TOKEN,
    SETTING_FIELDS,
    RULE_CONDITIONS,
    IMPORT_EXTENSIONS,
    KNIP_PACKAGE_NAME,
    ESLINT_OPTIONS_HELP,
    ESLINT_OPTION_STRING,
    DOCSTRING_CONVENTIONS,
    YAMLLINT_OPTIONS_HELP,
    STYLELINT_OPTIONS_HELP,
    COMMITLINT_OPTIONS_HELP,
    EXTRA_OPTIONS_DESCRIPTION,
    MARKDOWNLINT_OPTIONS_HELP,
} from '#cli/config/settings/schema.ts';

const extraTable = z.record(z.string(), z.unknown()).describe(EXTRA_OPTIONS_DESCRIPTION) satisfies z.ZodType<ToolTable>;

// Only tools whose writers read the options accept an extra table.
const toolOptionsSchema = z.strictObject({
    extra: reasonEnvelopeSchema(extraTable)
        .optional()
        .meta({ description: EXTRA_OPTIONS_DESCRIPTION, reason_needed: 'adding' }),
} satisfies SchemaShape<Pick<TableSettings<'tools.prettier'>, 'extra'>, NonNullable<WrittenTools['prettier']>>);

const firstEslintOption = z.union([
    z.string().regex(ESLINT_OPTION_STRING, { error: ESLINT_OPTIONS_HELP }),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.json()),
    z.record(z.string(), z.json()),
]) satisfies z.ZodType<JsonValue>;

const eslintOptions = z.union([z.array(z.never()).max(0), z.tuple([firstEslintOption]).rest(z.json())], {
    error: ESLINT_OPTIONS_HELP,
}) satisfies z.ZodType<TableSettings<'tools.eslint'>['rules'][string]>;

const eslintRules = z.record(z.string(), eslintOptions) satisfies z.ZodType<TableSettings<'tools.eslint'>['rules']>;

// Nested tool options retain the rule key before any option name or tuple index.
function settingHelp(issue: z.core.$ZodRawIssue, help: string): string {
    const path = issue.path ?? [];
    const rule = path[path.indexOf('rules') + 1];
    return help.replace(RULE_TOKEN, quoteArgument(String(rule)));
}

const commitlintRuleNames = [...Object.keys(COMMITLINT_RULES), 'type-enum', 'scope-enum'];
const commitlintRules = z.record(
    z.string().refine((name) => commitlintRuleNames.includes(name), {
        error: `Unknown commitlint rule. Accepted rules: ${commitlintRuleNames.join(', ')}.`,
    }),
    z.tuple(
        [
            z.enum(RULE_CONDITIONS, { error: (issue) => settingHelp(issue, COMMITLINT_OPTIONS_HELP) }),
            z.json().optional(),
        ],
        {
            error: (issue) => settingHelp(issue, COMMITLINT_OPTIONS_HELP),
        },
    ),
) satisfies z.ZodType<TableSettings<'tools.commitlint'>['rules']>;

const yamlOptions = z
    .object(
        {
            level: z.literal('error', { error: (issue) => settingHelp(issue, YAMLLINT_OPTIONS_HELP) }).optional(),
            ignore: z.never({ error: (issue) => settingHelp(issue, YAMLLINT_OPTIONS_HELP) }).optional(),
            'ignore-from-file': z.never({ error: (issue) => settingHelp(issue, YAMLLINT_OPTIONS_HELP) }).optional(),
        } satisfies SchemaShape<
            Omit<NonNullable<NonNullable<NonNullable<WrittenTools['yamllint']>['rules']>['indentation']>, 'spaces'>
        >,
        { error: (issue) => settingHelp(issue, YAMLLINT_OPTIONS_HELP) },
    )
    .catchall(z.json());

const yamlRules = z
    .object({
        indentation: yamlOptions
            .extend({
                spaces: z
                    .literal('consistent', { error: (issue) => settingHelp(issue, YAMLLINT_OPTIONS_HELP) })
                    .optional(),
            } satisfies SchemaShape<
                Pick<NonNullable<NonNullable<NonNullable<WrittenTools['yamllint']>['rules']>['indentation']>, 'spaces'>
            >)
            .optional(),
    } satisfies SchemaShape<NonNullable<NonNullable<WrittenTools['yamllint']>['rules']>>)
    .catchall(yamlOptions)
    .superRefine((rules, context) => {
        for (const name of Object.keys(rules))
            if (!(YAMLLINT_RULES as readonly string[]).includes(name))
                context.addIssue({
                    code: 'custom',
                    path: [name],
                    message: `Unknown yamllint rule. Accepted rules: ${YAMLLINT_RULES.join(', ')}.`,
                });
    });

const stylelintOptions = z
    .object({
        severity: z.literal('error', { error: STYLELINT_OPTIONS_HELP }).optional(),
    } satisfies SchemaShape<StylelintOptions>)
    .catchall(z.json());

const stylelintValue = z.union([z.literal(true), nonemptyString, z.number(), stylelintOptions]) satisfies z.ZodType<
    Exclude<TableSettings<'tools.stylelint'>['rules'][string], unknown[]>
>;

const stylelintRules = z.record(
    nonemptyString,
    z.union([stylelintValue, z.tuple([z.union([stylelintValue, z.array(z.json())]), stylelintOptions.optional()])], {
        error: STYLELINT_OPTIONS_HELP,
    }),
) satisfies z.ZodType<TableSettings<'tools.stylelint'>['rules']>;

const eslintTable = toolOptionsSchema.extend({
    import_extension: z.enum(IMPORT_EXTENSIONS).default('js').meta(SETTING_FIELDS.eslinttable_import_extension),
    restricted_imports: z
        .array(
            z.strictObject({
                name: z.string().describe('The import to refuse.'),
                message: z.string().describe('What to import instead.'),
            } satisfies SchemaShape<TableSettings<'tools.eslint'>['restricted_imports'][number]>),
        )
        .default([])
        .meta(SETTING_FIELDS.eslinttable_restricted_imports),
    rules: eslintRules.default({}).meta(SETTING_FIELDS.eslinttable_rules),
    override: z
        .array(
            z.strictObject({
                paths: nonemptyPaths.describe(RECORD_DESCRIPTIONS.eslint_paths),
                rules: eslintRules.optional().describe(RECORD_DESCRIPTIONS.eslint_rules),
                runtime: z.enum(ESLINT_RUNTIMES).optional().describe(RECORD_DESCRIPTIONS.eslint_runtime),
            } satisfies SchemaShape<NonNullable<NonNullable<WrittenTools['eslint']>['override']>[number]>),
        )
        .default([])
        .meta(SETTING_FIELDS.eslinttable_override),
} satisfies SchemaShape<
    Omit<TableSettings<'tools.eslint'>, 'extra'>,
    Omit<NonNullable<WrittenTools['eslint']>, 'extra'>
>);

export const toolsSchema = z.strictObject({
    hadolint: z
        .strictObject({
            trusted_registries: z.array(z.string()).default([]).meta(SETTING_FIELDS.hadolint_trusted_registries),
        } satisfies SchemaShape<TableSettings<'tools.hadolint'>, NonNullable<WrittenTools['hadolint']>>)
        .optional(),
    nginx: z
        .strictObject({
            image: nonemptyString.default('nginx:1.29.3-alpine').meta(SETTING_FIELDS.nginx_image),
        } satisfies SchemaShape<TableSettings<'tools.nginx'>, NonNullable<WrittenTools['nginx']>>)
        .optional(),
    ruff: z
        .strictObject({
            docstring_convention: z
                .enum(DOCSTRING_CONVENTIONS)
                .optional()
                .meta(SETTING_FIELDS.ruff_docstring_convention),
        } satisfies SchemaShape<TableSettings<'tools.ruff'>, NonNullable<WrittenTools['ruff']>>)
        .optional(),
    semgrep: z
        .strictObject({
            registry_packs: z
                .array(z.string())
                .default(['p/owasp-top-ten'])
                .meta(SETTING_FIELDS.semgrep_registry_packs),
            rule_files: z.array(relativePath).default([]).meta(SETTING_FIELDS.semgrep_rule_files),
        } satisfies SchemaShape<TableSettings<'tools.semgrep'>, NonNullable<WrittenTools['semgrep']>>)
        .optional(),
    sqlfluff: z
        .strictObject({
            dialect: z
                .string()
                .regex(/^[a-z][a-z0-9_]*$/u)
                .default('ansi')
                .meta(SETTING_FIELDS.sqlfluff_dialect),
        } satisfies SchemaShape<TableSettings<'tools.sqlfluff'>, NonNullable<WrittenTools['sqlfluff']>>)
        .optional(),
    swiftlint: z
        .strictObject({
            always_keep_imports: z.array(z.string()).default([]).meta(SETTING_FIELDS.swiftlint_always_keep_imports),
        } satisfies SchemaShape<TableSettings<'tools.swiftlint'>, NonNullable<WrittenTools['swiftlint']>>)
        .optional(),
    trivy: z
        .strictObject({
            severity: z.array(z.string()).default(['HIGH', 'CRITICAL']).meta(SETTING_FIELDS.trivy_severity),
        } satisfies SchemaShape<TableSettings<'tools.trivy'>, NonNullable<WrittenTools['trivy']>>)
        .optional(),
    eslint: eslintTable.optional(),
    commitlint: z
        .strictObject({
            types: nonemptyStrings
                .default(['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'build', 'ci', 'chore', 'style', 'revert'])
                .meta(SETTING_FIELDS.commitlint_types),
            scopes: nonemptyStrings.default([]).meta(SETTING_FIELDS.commitlint_scopes),
            rules: commitlintRules.default({}).meta(SETTING_FIELDS.commitlint_rules),
        } satisfies SchemaShape<TableSettings<'tools.commitlint'>, NonNullable<WrittenTools['commitlint']>>)
        .optional(),
    yamllint: z
        .strictObject({
            rules: yamlRules.default({}).meta(SETTING_FIELDS.yamllint_rules),
        } satisfies SchemaShape<TableSettings<'tools.yamllint'>, NonNullable<WrittenTools['yamllint']>>)
        .optional(),
    markdownlint: z
        .strictObject({
            rules: z
                .record(
                    z.string().regex(/^MD\d{3}$/u, { error: MARKDOWNLINT_OPTIONS_HELP }),
                    z.record(z.string(), z.json(), { error: MARKDOWNLINT_OPTIONS_HELP }),
                    { error: MARKDOWNLINT_OPTIONS_HELP },
                )
                .default({})
                .meta(SETTING_FIELDS.markdownlint_rules),
        } satisfies SchemaShape<TableSettings<'tools.markdownlint'>, NonNullable<WrittenTools['markdownlint']>>)
        .optional(),
    stylelint: z
        .strictObject({
            rules: stylelintRules.default({}).meta(SETTING_FIELDS.stylelint_rules),
        } satisfies SchemaShape<TableSettings<'tools.stylelint'>, NonNullable<WrittenTools['stylelint']>>)
        .optional(),
    squawk: z
        .strictObject({
            assume_in_transaction: z.boolean().default(false).meta(SETTING_FIELDS.squawk_assume_in_transaction),
        } satisfies SchemaShape<TableSettings<'tools.squawk'>, NonNullable<WrittenTools['squawk']>>)
        .optional(),
    prettier: toolOptionsSchema.optional(),
    'editorconfig-checker': toolOptionsSchema
        .extend({
            extra: toolOptionsSchema.shape.extra.describe(
                'Extra options passed to the tool as written. These options go into .editorconfig.',
            ),
        } satisfies SchemaShape<
            TableSettings<'tools.editorconfig-checker'>,
            NonNullable<WrittenTools['editorconfig-checker']>
        >)
        .optional(),
    typos: toolOptionsSchema.optional(),
    shellcheck: toolOptionsSchema.optional(),
    knip: toolOptionsSchema
        .extend({
            entry: z.array(relativePath).default([]).meta(SETTING_FIELDS.knip_entry),
            ignore_dependencies: reasonValue(
                z.array(
                    z
                        .string()
                        .min(1)
                        .regex(KNIP_PACKAGE_NAME, 'Use an exact package name, without a regular expression.'),
                ),
            )
                .default([])
                .meta(SETTING_FIELDS.knip_ignore_dependencies),
        } satisfies SchemaShape<
            Omit<TableSettings<'tools.knip'>, 'extra'>,
            Omit<NonNullable<WrittenTools['knip']>, 'extra'>
        >)
        .optional(),
    purgecss: z
        .strictObject({
            safelist: reasonValue(nonemptyStrings).default([]).meta(SETTING_FIELDS.purgecss_safelist),
        } satisfies SchemaShape<TableSettings<'tools.purgecss'>, NonNullable<WrittenTools['purgecss']>>)
        .optional(),
    v8r: z
        .strictObject({
            schema: z
                .array(
                    z.strictObject({
                        paths: nonemptyPaths.describe(RECORD_DESCRIPTIONS.v8r_paths),
                        url: z.url().describe(RECORD_DESCRIPTIONS.v8r_url),
                    } satisfies SchemaShape<TableSettings<'tools.v8r'>['schema'][number]>),
                )
                .default([])
                .meta(SETTING_FIELDS.v8r_schema),
        } satisfies SchemaShape<TableSettings<'tools.v8r'>, NonNullable<WrittenTools['v8r']>>)
        .optional(),
    taplo: toolOptionsSchema.optional(),
} satisfies SchemaShape<ParsedTools, WrittenTools>);
