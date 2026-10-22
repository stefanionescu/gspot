import { z } from 'zod';
import { relativePath } from '#cli/schemas/settings/fields.ts';
import type { TableSettings } from '#cli/types/settings/file.ts';
import type { ParsedTools } from '#cli/types/settings/tool-tables.ts';
import { type JsonValue, type SchemaShape } from '#cli/types/shapes.ts';
import { buildRuleTableSchema } from '#cli/schemas/settings/rule-tables.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { ESLINT_PLUGIN_NAME, ESLINT_PLUGIN_MODULE, ESLINT_OPTION_STRING } from '#cli/config/settings/eslint.ts';

const firstEslintOption = z.union([
    z.string().regex(ESLINT_OPTION_STRING),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.json()),
    z.record(z.string(), z.json()),
]) satisfies z.ZodType<JsonValue>;

const eslintOptions = z.union([
    z.array(z.never()).max(0),
    z.tuple([firstEslintOption]).rest(z.json()),
]) satisfies z.ZodType<TableSettings<'tools.eslint'>['rules'][string]>;

export const eslintRules = buildRuleTableSchema(
    z.record(z.string(), eslintOptions),
    'javascript/eslint',
) satisfies z.ZodType<TableSettings<'tools.eslint'>['rules']>;

export const eslintPluginsSchema = z
    .array(
        z.strictObject({
            name: z
                .string()
                .regex(ESLINT_PLUGIN_NAME, 'Use a lowercase rule prefix, such as local.')
                .meta(SETTING_DEFINITIONS['tools.eslint.plugins.name']),
            path: relativePath
                .regex(ESLINT_PLUGIN_MODULE, 'Name a .js or .mjs module.')
                .meta(SETTING_DEFINITIONS['tools.eslint.plugins.path']),
            rules: eslintRules.meta(SETTING_DEFINITIONS['tools.eslint.plugins.rules']),
        } satisfies SchemaShape<NonNullable<ParsedTools['eslint']>['plugins'][number]>),
    )
    .default(SETTING_DEFINITIONS['tools.eslint.plugins'].default)
    .meta(SETTING_DEFINITIONS['tools.eslint.plugins']);
