import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { TableSettings } from '#cli/types/settings/file.ts';
import type { StylelintOptions } from '#cli/types/settings/tools.ts';
import { nonemptyString } from '#cli/schemas/configurations/fields.ts';
import { buildRuleTableSchema } from '#cli/schemas/settings/tools/rules.ts';

const stylelintOptions = z
    .object({
        severity: z.literal('error').optional(),
    } satisfies SchemaShape<StylelintOptions>)
    .catchall(z.json());

const stylelintValue = z.union([z.literal(true), nonemptyString, z.number(), stylelintOptions]) satisfies z.ZodType<
    Exclude<TableSettings<'tools.stylelint'>['rules'][string], unknown[]>
>;
const stylelintTupleSchema = z.tuple([
    z.union([stylelintValue, z.json().array()]),
    stylelintOptions.optional(),
]) satisfies z.ZodType<Extract<TableSettings<'tools.stylelint'>['rules'][string], unknown[]>>;

export const stylelintRules = buildRuleTableSchema(
    z.record(nonemptyString, z.union([stylelintValue, stylelintTupleSchema])),
    'css/stylelint',
) satisfies z.ZodType<TableSettings<'tools.stylelint'>['rules']>;
