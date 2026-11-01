import { z } from 'zod';
import { isTable } from '#cli/system/tables.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { nonemptyStringSchema } from '#cli/schemas/manifests/tools.ts';
import { allowReasonedValue, relativePathSchema, nonemptyStringsSchema } from '#cli/schemas/settings/fields.ts';

import {
    RULE_CONDITIONS,
    ESLINT_SEVERITIES,
    ESLINT_PLUGIN_NAME,
    ESLINT_PLUGIN_MODULE,
} from '#cli/config/settings/schema.ts';

const commitlintValuesSchema = z.record(
    z.string().superRefine((name, context) => {
        const configuration = readConfigurations().get('commits');
        if (configuration === undefined) throw new Error('The commits manifest is missing.');
        const names = [...Object.keys(configuration.commitlint.rules), 'type-enum', 'scope-enum'];
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
    return `This table holds options only, without a severity; the level decides which rules run. To turn ${quoted} off, run gspot ignore ${checkId} --rule ${quoted} --reason "<why>".`;
}

/**
Validate each rule with one refusal while retaining its published value schema.

@param schema the accepted rule names and option values.
@param checkId the check whose ignore command accepts a refusal.
@returns the rule table schema with one issue per invalid rule.
*/
export function buildRuleTableSchema<Schema extends z.ZodType>(
    schema: Schema,
    checkId: string,
): z.ZodType<z.output<Schema>, z.input<Schema>> {
    return z.preprocess((table: z.input<Schema>, context) => {
        if (!isTable(table)) return table;
        for (const [rule, value] of Object.entries(table)) {
            const parsed = schema.safeParse({ [rule]: value });
            if (parsed.success) continue;
            for (const issue of parsed.error.issues.slice(0, 1)) {
                context.addIssue({
                    code: 'custom',
                    path: [rule],
                    message: formatRuleHelp({ ...issue, path: ['rules', rule] }, checkId),
                });
            }
        }
        return table;
    }, schema);
}

const commitlintRulesSchema = buildRuleTableSchema(commitlintValuesSchema, 'commits/commitlint');

export const commitlintSchema = z
    .strictObject({
        types: allowReasonedValue(nonemptyStringsSchema, {
            reason_when: 'adding',
            configurations: ['commits'],
            description: 'The commit types the type-enum rule allows.',
            default: ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'build', 'ci', 'chore', 'style', 'revert'] as [
                'feat',
                'fix',
                'refactor',
                'perf',
                'docs',
                'test',
                'build',
                'ci',
                'chore',
                'style',
                'revert',
            ],
        }),
        scopes: nonemptyStringsSchema.default([] as []).meta({
            template: 'repository',
            configurations: ['commits'],
            description:
                'Commit scopes that the scope-enum rule accepts, and a message may leave out its scope. When empty, gspot uses the last segment of each project scope path, or no list without project scopes.',
        }),
        rules: commitlintRulesSchema.default({}).meta({
            configurations: ['commits'],
            description:
                'Options for active commitlint rules, by rule name: an always/never condition and an optional value, without a severity; the level decides which rules run. Accept a finding with `gspot ignore commits/commitlint --rule <rule> --reason "<why>"`.',
        }),
    })
    .optional();

const firstEslintOptionSchema = z.union([
    z.string().refine((value) => !(ESLINT_SEVERITIES as readonly string[]).includes(value)),
    z.number(),
    z.boolean(),
    z.null(),
    z.json().array(),
    z.record(z.string(), z.json()),
]);

const eslintOptionsSchema = z.union([z.never().array().max(0), z.tuple([firstEslintOptionSchema]).rest(z.json())]);

export const eslintRulesSchema = buildRuleTableSchema(z.record(z.string(), eslintOptionsSchema), 'javascript/eslint');

export const eslintPluginsSchema = z
    .strictObject({
        name: z.string().regex(ESLINT_PLUGIN_NAME, 'Use a lowercase rule prefix, such as local.').meta({
            description: 'The rule prefix, such as local in local/no-legacy-api.',
        }),
        path: relativePathSchema.regex(ESLINT_PLUGIN_MODULE, 'Name a .js or .mjs module.').meta({
            description: 'The plugin module, relative to the repository root.',
        }),
        rules: eslintRulesSchema.meta({
            description: 'The rules of the plugin to turn on, with their options.',
        }),
    })
    .array()
    .default([] as [])
    .meta({
        configurations: ['javascript'],
        description:
            'Your own ESLint plugins: a rule prefix as name, a tracked .js or .mjs module as path, and the rules that turn on as errors.',
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

export const stylelintRulesSchema = buildRuleTableSchema(
    z.record(nonemptyStringSchema, z.union([stylelintValueSchema, stylelintTupleSchema])),
    'css/stylelint',
);
