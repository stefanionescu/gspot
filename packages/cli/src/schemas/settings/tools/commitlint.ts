import { z } from 'zod';
import { readConfigurations } from '#cli/manifests/read.ts';
import { RULE_CONDITIONS } from '#cli/config/settings/tools/tables.ts';
import { buildRuleTableSchema } from '#cli/schemas/settings/tools/rules.ts';
import { allowReasonedValue, nonemptyStringsSchema } from '#cli/schemas/settings/fields.ts';

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
