import { z } from 'zod';
import type { SchemaShape } from '#cli/types/objects.ts';
import { nonemptyString } from '#cli/settings/schema/parts.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';
import type { StylelintOptions } from '#cli/types/settings/file.ts';
import { STYLELINT_OPTIONS_HELP } from '#cli/config/settings/schema.ts';

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

export { stylelintRules };
