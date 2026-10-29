import { z } from 'zod';
import type { ParsedTools } from '#cli/types/settings/tools.ts';
import type { TableSettings } from '#cli/types/settings/file.ts';
import type { JsonValue, SchemaShape } from '#cli/types/shapes.ts';
import { relativePathSchema } from '#cli/schemas/settings/fields.ts';
import { buildRuleTableSchema } from '#cli/schemas/settings/tools/rules.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { ESLINT_SEVERITIES, ESLINT_PLUGIN_NAME, ESLINT_PLUGIN_MODULE } from '#cli/config/settings/tools/eslint.ts';

const firstEslintOptionSchema = z.union([
    z.string().refine((value) => !(ESLINT_SEVERITIES as readonly string[]).includes(value)),
    z.number(),
    z.boolean(),
    z.null(),
    z.json().array(),
    z.record(z.string(), z.json()),
]) satisfies z.ZodType<JsonValue>;

const eslintOptionsSchema = z.union([
    z.never().array().max(0),
    z.tuple([firstEslintOptionSchema]).rest(z.json()),
]) satisfies z.ZodType<TableSettings<'tools.eslint'>['rules'][string]>;

export const eslintRulesSchema = buildRuleTableSchema(
    z.record(z.string(), eslintOptionsSchema),
    'javascript/eslint',
) satisfies z.ZodType<TableSettings<'tools.eslint'>['rules']>;

export const eslintPluginsSchema = z
    .strictObject({
        name: z
            .string()
            .regex(ESLINT_PLUGIN_NAME, 'Use a lowercase rule prefix, such as local.')
            .meta(SETTING_DEFINITIONS['tools.eslint.plugins.name']),
        path: relativePathSchema
            .regex(ESLINT_PLUGIN_MODULE, 'Name a .js or .mjs module.')
            .meta(SETTING_DEFINITIONS['tools.eslint.plugins.path']),
        rules: eslintRulesSchema.meta(SETTING_DEFINITIONS['tools.eslint.plugins.rules']),
    } satisfies SchemaShape<NonNullable<ParsedTools['eslint']>['plugins'][number]>)
    .array()
    .default(SETTING_DEFINITIONS['tools.eslint.plugins'].default)
    .meta(SETTING_DEFINITIONS['tools.eslint.plugins']);
