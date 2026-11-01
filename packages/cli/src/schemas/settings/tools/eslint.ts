import { z } from 'zod';
import { relativePathSchema } from '#cli/schemas/settings/fields.ts';
import { buildRuleTableSchema } from '#cli/schemas/settings/tools/rules.ts';
import { ESLINT_SEVERITIES, ESLINT_PLUGIN_NAME, ESLINT_PLUGIN_MODULE } from '#cli/config/settings/tools/eslint.ts';

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
