import { z } from 'zod';
import semver from 'semver';
import { readConfigurations } from '#cli/manifests/read.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import { isTable, getRequired } from '#cli/system/tables.ts';
import { nonemptyStringSchema } from '#cli/schemas/manifests/fields.ts';
import { allowReasonedValue, relativePathSchema, nonemptyStringsSchema } from '#cli/schemas/settings/fields.ts';

import {
    RULE_CONDITIONS,
    NPM_PACKAGE_NAME,
    ESLINT_SEVERITIES,
    ESLINT_PLUGIN_NAME,
    VENDOR_PREFIX_RULE,
    ESLINT_PLUGIN_MODULE,
    PLUGIN_SOURCE_REFUSAL,
    MATCHING_PROPERTY_NAME,
    COMMITLINT_ENUM_SETTINGS,
} from '#cli/config/settings/tables.ts';

const commitlintValuesSchema = z.record(
    z.string().superRefine((name, context) => {
        const setting = COMMITLINT_ENUM_SETTINGS.get(name);
        if (setting !== undefined) {
            context.addIssue({ code: 'custom', message: `Set ${setting} instead.` });
            return;
        }
        const { commitlint } = getRequired(readConfigurations(), 'commits', 'configuration');
        const names = Object.keys(commitlint.rules);
        if (names.includes(name)) return;
        context.addIssue({
            code: 'custom',
            message: `There is no commitlint rule called ${name}. The commitlint rules are ${names.join(', ')}.`,
        });
    }),
    z.tuple([z.enum(RULE_CONDITIONS), z.json().optional()]),
);

function formatRuleHelp(issue: z.core.$ZodIssue, checkId: string): string {
    if (issue.code === 'invalid_key') return issue.issues.map(({ message }) => message).join(' ');
    const path = issue.path;
    const rule = path[path.indexOf('rules') + 1];
    const quoted = quoteArgument(String(rule));
    return `This table holds options only, without a severity; the level decides which rules run. To ignore ${quoted}, run gspot ignore ${checkId} --rule ${quoted} --reason "<why>".`;
}

export function buildRuleTableSchema<Schema extends z.ZodType>(
    schema: Schema,
    checkId: string,
): z.ZodType<z.output<Schema>, z.input<Schema>> {
    return z.preprocess((table: z.input<Schema>, context) => {
        if (!isTable(table)) return table;
        for (const [rule, value] of Object.entries(table)) {
            const issue = schema.safeParse({ [rule]: value }).error?.issues[0];
            if (issue === undefined) continue;
            context.addIssue({
                code: 'custom',
                path: [rule],
                message: formatRuleHelp({ ...issue, path: ['rules', rule] }, checkId),
            });
        }
        return table;
    }, schema);
}

const commitlintRulesSchema = buildRuleTableSchema(commitlintValuesSchema, 'commits/commitlint');

export const commitsSchema = z
    .strictObject({
        types: allowReasonedValue(nonemptyStringsSchema, {
            reason_for: 'adding',
            configurations: ['commits'],
            description: 'The commit types the type-enum rule allows.',
            default: ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'build', 'ci', 'chore', 'style', 'revert'],
        }),
        scopes: nonemptyStringsSchema.default([]).meta({
            leftOut: 'repository',
            configurations: ['commits'],
            description:
                'The commit scopes that a message may use. A message may also leave out its scope. When empty, gspot allows the last folder name of each `[[scope]]` path, or any commit scope when `gspot.toml` has no `[[scope]]`.',
        }),
    })
    .optional();

export const commitlintSchema = z
    .strictObject({
        rules: commitlintRulesSchema.default({}).meta({
            configurations: ['commits'],
            description:
                'Options for active commitlint rules, by rule name: an always/never condition and an optional value, without a severity; the level decides which rules run. Ignore a finding with `gspot ignore commits/commitlint --rule <rule> --reason "<why>"`.',
        }),
    })
    .optional();

const firstEslintOptionSchema = z.union([
    z
        .string()
        .refine(
            (value) => !(ESLINT_SEVERITIES as readonly string[]).includes(value),
            'Leave out the severity; the level decides which rules run.',
        ),
    z.number(),
    z.boolean(),
    z.null(),
    z.json().array(),
    z.record(z.string(), z.json()),
]);

const eslintOptionsSchema = z.union([z.never().array().max(0), z.tuple([firstEslintOptionSchema]).rest(z.json())]);

export const eslintRulesSchema = buildRuleTableSchema(z.record(z.string(), eslintOptionsSchema), 'javascript/eslint');

const pluginSourceSchema = z
    .strictObject({
        path: relativePathSchema
            .refine((path) => ESLINT_PLUGIN_MODULE.test(path), 'Name a .js or .mjs module.')
            .optional()
            .meta({
                description: 'A tracked plugin module, relative to the table that sets it. Leave it out with package.',
            }),
        package: z.string().regex(NPM_PACKAGE_NAME, 'Use an npm package name.').optional().meta({
            description: 'An npm package that gspot install puts in .gspot/node_modules. Leave it out with path.',
        }),
        version: z
            .string()
            .refine((version) => semver.valid(version) === version, 'Use an exact version, such as 1.2.3.')
            .optional()
            .meta({
                description: 'The exact version of the package.',
            }),
    })
    .refine(
        (plugin) =>
            plugin.path === undefined
                ? plugin.package !== undefined && plugin.version !== undefined
                : plugin.package === undefined && plugin.version === undefined,
        PLUGIN_SOURCE_REFUSAL,
    );

export const eslintPluginsSchema = pluginSourceSchema
    .safeExtend({
        name: z.string().regex(ESLINT_PLUGIN_NAME, 'Use a lowercase rule prefix, such as local.').meta({
            description: 'The rule prefix, such as local in local/no-legacy-api.',
        }),
        rules: eslintRulesSchema.meta({
            description: 'The rules of the plugin to turn on, with their options.',
        }),
    })
    .array()
    .default([])
    .meta({
        configurations: ['javascript'],
        description:
            'ESLint plugins of your own: a rule prefix as name, a tracked .js or .mjs module as path or a pinned npm package as package and version, and the rules that turn on as errors.',
    });

const stylelintOptionsSchema = z
    .object({
        severity: z.literal('error').optional(),
    })
    .catchall(z.json());

const stylelintValueSchema = z.union([z.literal(true), nonemptyStringSchema, z.number(), stylelintOptionsSchema]);

const stylelintTupleSchema = z.tuple([
    z.union([stylelintValueSchema, z.json().array()]),
    stylelintOptionsSchema.optional(),
]);

/**
Stylelint compares each `ignoreProperties` name with the property as the stylesheet writes it, prefix included. A
name with no prefix matches no property that the rule reports, and the fixer then deletes the prefix.
*/
export const stylelintRulesSchema = buildRuleTableSchema(
    z.record(nonemptyStringSchema, z.union([stylelintValueSchema, stylelintTupleSchema])),
    'css/stylelint',
).superRefine((rules, context) => {
    const value = rules[VENDOR_PREFIX_RULE];
    const options = Array.isArray(value) ? value[1] : undefined;
    const ignored = isTable(options) ? options['ignoreProperties'] : undefined;
    for (const [index, name] of [ignored ?? []].flat().entries()) {
        if (typeof name !== 'string' || MATCHING_PROPERTY_NAME.test(name)) continue;
        context.addIssue({
            code: 'custom',
            path: [VENDOR_PREFIX_RULE, 1, 'ignoreProperties', index],
            message: `Stylelint matches ${name} against the property as written, so it ignores nothing. Write the prefixed name, such as -webkit-${name}.`,
        });
    }
});

export const stylelintPluginsSchema = pluginSourceSchema
    .safeExtend({
        rules: stylelintRulesSchema.meta({
            description: 'The rules of the plugin to turn on, with their options.',
        }),
    })
    .array()
    .default([])
    .meta({
        configurations: ['css'],
        description:
            'Stylelint plugins of your own: a tracked .js or .mjs module as path or a pinned npm package as package and version, and the rules that turn on as errors.',
    });
