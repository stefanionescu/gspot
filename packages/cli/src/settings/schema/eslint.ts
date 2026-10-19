import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { JsonValue } from '#cli/types/parsers/json.ts';
import { relativePath } from '#cli/settings/schema/parts.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';
import type { ParsedTools } from '#cli/types/settings/tool-tables.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';

import {
    ESLINT_PLUGIN_NAME,
    ESLINT_OPTIONS_HELP,
    ESLINT_PLUGIN_MODULE,
    ESLINT_OPTION_STRING,
} from '#cli/config/settings/schema.ts';

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

/** ESLint option arrays by rule ID, without a severity. */
const eslintRules = z.record(z.string(), eslintOptions) satisfies z.ZodType<TableSettings<'tools.eslint'>['rules']>;

/** Your own ESLint plugins: each module, its rule prefix, and the rules that turn on. */
const eslintPluginsSchema = z
    .array(
        z.strictObject({
            name: z
                .string()
                .regex(ESLINT_PLUGIN_NAME, 'Use a lowercase rule prefix, such as local.')
                .describe('The rule prefix, such as local in local/no-legacy-api.'),
            path: relativePath
                .regex(ESLINT_PLUGIN_MODULE, 'Name a .js or .mjs module.')
                .describe('The plugin module, relative to the repository root.'),
            rules: eslintRules.describe('The rules of the plugin to turn on, with their options.'),
        } satisfies SchemaShape<NonNullable<ParsedTools['eslint']>['plugins'][number]>),
    )
    .default([])
    .meta(SETTING_DECLARATIONS['tools.eslint.plugins']);

export { eslintRules, eslintPluginsSchema };
