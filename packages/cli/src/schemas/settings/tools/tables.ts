import { z } from 'zod';
import { nonemptyStringSchema } from '#cli/schemas/manifests/fields.ts';
import { buildRuleTableSchema } from '#cli/schemas/settings/tools/rules.ts';
import { stylelintRulesSchema } from '#cli/schemas/settings/tools/stylelint.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { COMMITLINT_RULES } from '#cli/config/generation/configurations/general/commits.ts';
import { YAMLLINT_RULES } from '#cli/config/generation/configurations/general/data-files.ts';
import { eslintRulesSchema, eslintPluginsSchema } from '#cli/schemas/settings/tools/eslint.ts';

import {
    relativePathSchema,
    allowReasonedValue,
    nonemptyPathsSchema,
    nonemptyStringsSchema,
} from '#cli/schemas/settings/fields.ts';
import {
    RULE_CONDITIONS,
    TRIVY_SEVERITIES,
    SQLFLUFF_DIALECTS,
    KNIP_PACKAGE_NAME,
    MARKDOWNLINT_RULE_ID,
    DOCSTRING_CONVENTIONS,
    IMPORT_EXTENSION_STYLES,
    MARKDOWNLINT_RULE_ID_REFUSAL,
} from '#cli/config/settings/tools/tables.ts';

const commitlintRuleNames = [...Object.keys(COMMITLINT_RULES), 'type-enum', 'scope-enum'];

const commitlintValuesSchema = z.record(
    z.string().refine((name) => commitlintRuleNames.includes(name), {
        error: (issue) =>
            `There is no commitlint rule called ${String(issue.input)}. The commitlint rules are ${commitlintRuleNames.join(', ')}.`,
    }),
    z.tuple([z.enum(RULE_CONDITIONS), z.json().optional()]),
);

const commitlintRulesSchema = buildRuleTableSchema(commitlintValuesSchema, 'commits/commitlint');

const yamlOptionsSchema = z
    .object({
        level: z.literal('error').optional().describe('Report findings from this YAML rule as errors.'),
        ignore: z.never().optional(),
        'ignore-from-file': z.never().optional(),
    })
    .catchall(z.json());

const yamlIndentationSchema = yamlOptionsSchema.extend({
    spaces: z
        .literal('consistent')
        .optional()
        .describe('Require the same indentation width throughout each YAML file.'),
});

const yamlRuleNameSchema = z.string().refine((name) => (YAMLLINT_RULES as readonly string[]).includes(name), {
    error: (issue) =>
        `There is no yamllint rule called ${String(issue.input)}. The yamllint rules are ${YAMLLINT_RULES.join(', ')}.`,
});

const yamlRulesSchema = buildRuleTableSchema(
    z
        .object({ indentation: yamlIndentationSchema.optional().describe('Options for YAML indentation consistency.') })
        .catchall(yamlOptionsSchema)
        .pipe(z.record(yamlRuleNameSchema, yamlOptionsSchema))
        .meta({ type: 'object' }),
    'data-files/yamllint',
);

const eslintTableSchema = z.strictObject({
    import_extension: z
        .enum(IMPORT_EXTENSION_STYLES)
        .default(SETTING_DEFINITIONS['tools.eslint.import_extension'].default)
        .meta(SETTING_DEFINITIONS['tools.eslint.import_extension']),
    restricted_imports: z
        .strictObject({
            name: z.string().meta(SETTING_DEFINITIONS['tools.eslint.restricted_imports.name']),
            message: z.string().meta(SETTING_DEFINITIONS['tools.eslint.restricted_imports.message']),
        })
        .array()
        .default(SETTING_DEFINITIONS['tools.eslint.restricted_imports'].default)
        .meta(SETTING_DEFINITIONS['tools.eslint.restricted_imports']),
    rules: eslintRulesSchema
        .default(SETTING_DEFINITIONS['tools.eslint.rules'].default)
        .meta(SETTING_DEFINITIONS['tools.eslint.rules']),
    override: z
        .strictObject({
            paths: nonemptyPathsSchema.meta(SETTING_DEFINITIONS['tools.eslint.override.paths']),
            rules: eslintRulesSchema.optional().meta(SETTING_DEFINITIONS['tools.eslint.override.rules']),
            runtime: nonemptyStringSchema.optional().meta(SETTING_DEFINITIONS['tools.eslint.override.runtime']),
        })
        .array()
        .default(SETTING_DEFINITIONS['tools.eslint.override'].default)
        .meta(SETTING_DEFINITIONS['tools.eslint.override']),
    plugins: eslintPluginsSchema,
});

const markdownlintOptionsSchema = z.record(z.string(), z.json());

const markdownlintRulesSchema = buildRuleTableSchema(
    z.record(
        z.string().regex(MARKDOWNLINT_RULE_ID, { error: MARKDOWNLINT_RULE_ID_REFUSAL }),
        markdownlintOptionsSchema,
    ),
    'markdown/markdownlint',
);

const markdownlintSchema = z.strictObject({
    rules: markdownlintRulesSchema
        .default(SETTING_DEFINITIONS['tools.markdownlint.rules'].default)
        .meta(SETTING_DEFINITIONS['tools.markdownlint.rules']),
});

const knipSchema = z.strictObject({
    entry: relativePathSchema
        .array()
        .default(SETTING_DEFINITIONS['tools.knip.entry'].default)
        .meta(SETTING_DEFINITIONS['tools.knip.entry']),
    ignore_dependencies: allowReasonedValue(
        z.string().min(1).regex(KNIP_PACKAGE_NAME, 'Use an exact package name, without a regular expression.').array(),
        SETTING_DEFINITIONS['tools.knip.ignore_dependencies'],
    ),
});

const validationTargetSchema = z.strictObject({
    paths: nonemptyPathsSchema.meta(SETTING_DEFINITIONS['tools.v8r.schema.paths']),
    url: z.url().meta(SETTING_DEFINITIONS['tools.v8r.schema.url']),
});

export const toolsSchema = z.strictObject({
    hadolint: z
        .strictObject({
            trusted_registries: z
                .string()
                .array()
                .default(SETTING_DEFINITIONS['tools.hadolint.trusted_registries'].default)
                .meta(SETTING_DEFINITIONS['tools.hadolint.trusted_registries']),
        })
        .optional(),
    nginx: z
        .strictObject({
            image: nonemptyStringSchema
                .default(SETTING_DEFINITIONS['tools.nginx.image'].default)
                .meta(SETTING_DEFINITIONS['tools.nginx.image']),
        })
        .optional(),
    ruff: z
        .strictObject({
            docstring_convention: z
                .enum(DOCSTRING_CONVENTIONS)
                .optional()
                .meta(SETTING_DEFINITIONS['tools.ruff.docstring_convention']),
        })
        .optional(),
    semgrep: z
        .strictObject({
            registry_packs: z
                .string()
                .array()
                .default(SETTING_DEFINITIONS['tools.semgrep.registry_packs'].default)
                .meta(SETTING_DEFINITIONS['tools.semgrep.registry_packs']),
            rule_files: relativePathSchema
                .array()
                .default(SETTING_DEFINITIONS['tools.semgrep.rule_files'].default)
                .meta(SETTING_DEFINITIONS['tools.semgrep.rule_files']),
        })
        .optional(),
    sqlfluff: z
        .strictObject({
            dialect: z
                .enum(SQLFLUFF_DIALECTS)
                .default(SETTING_DEFINITIONS['tools.sqlfluff.dialect'].default)
                .meta(SETTING_DEFINITIONS['tools.sqlfluff.dialect']),
        })
        .optional(),
    swiftlint: z
        .strictObject({
            always_keep_imports: z
                .string()
                .array()
                .default(SETTING_DEFINITIONS['tools.swiftlint.always_keep_imports'].default)
                .meta(SETTING_DEFINITIONS['tools.swiftlint.always_keep_imports']),
        })
        .optional(),
    trivy: z
        .strictObject({
            severity: z
                .enum(TRIVY_SEVERITIES)
                .array()
                .default(SETTING_DEFINITIONS['tools.trivy.severity'].default)
                .meta(SETTING_DEFINITIONS['tools.trivy.severity']),
        })
        .optional(),
    eslint: eslintTableSchema.optional(),
    commitlint: z
        .strictObject({
            types: allowReasonedValue(nonemptyStringsSchema, SETTING_DEFINITIONS['tools.commitlint.types']),
            scopes: nonemptyStringsSchema
                .default(SETTING_DEFINITIONS['tools.commitlint.scopes'].default)
                .meta(SETTING_DEFINITIONS['tools.commitlint.scopes']),
            rules: commitlintRulesSchema
                .default(SETTING_DEFINITIONS['tools.commitlint.rules'].default)
                .meta(SETTING_DEFINITIONS['tools.commitlint.rules']),
        })
        .optional(),
    yamllint: z
        .strictObject({
            rules: yamlRulesSchema
                .default(SETTING_DEFINITIONS['tools.yamllint.rules'].default)
                .meta(SETTING_DEFINITIONS['tools.yamllint.rules']),
        })
        .optional(),
    markdownlint: markdownlintSchema.optional(),
    stylelint: z
        .strictObject({
            rules: stylelintRulesSchema
                .default(SETTING_DEFINITIONS['tools.stylelint.rules'].default)
                .meta(SETTING_DEFINITIONS['tools.stylelint.rules']),
        })
        .optional(),
    squawk: z
        .strictObject({
            assume_in_transaction: z
                .boolean()
                .default(SETTING_DEFINITIONS['tools.squawk.assume_in_transaction'].default)
                .meta(SETTING_DEFINITIONS['tools.squawk.assume_in_transaction']),
        })
        .optional(),
    knip: knipSchema.optional(),
    purgecss: z
        .strictObject({
            safelist: allowReasonedValue(nonemptyStringsSchema, SETTING_DEFINITIONS['tools.purgecss.safelist']),
        })
        .optional(),
    v8r: z
        .strictObject({
            schema: validationTargetSchema
                .array()
                .default(SETTING_DEFINITIONS['tools.v8r.schema'].default)
                .meta(SETTING_DEFINITIONS['tools.v8r.schema']),
        })
        .optional(),
});

for (const [tool, schema] of Object.entries(toolsSchema.shape))
    z.globalRegistry.add(schema, { description: `Options that gspot writes to the ${tool} configuration.` });
