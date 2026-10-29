import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { TableSettings } from '#cli/types/settings/file.ts';
import type { StylelintOptions } from '#cli/types/settings/tools.ts';
import { buildRuleTableSchema } from '#cli/schemas/settings/tools/rules.ts';
import { nonemptyStringSchema } from '#cli/schemas/configurations/fields.ts';

const stylelintOptionsSchema = z
    .object({
        severity: z.literal('error').optional(),
    } satisfies SchemaShape<StylelintOptions>)
    .catchall(z.json());

const stylelintValueSchema = z.union([
    z.literal(true),
    nonemptyStringSchema,
    z.number(),
    stylelintOptionsSchema,
]) satisfies z.ZodType<Exclude<TableSettings<'tools.stylelint'>['rules'][string], unknown[]>>;

const stylelintTupleSchema = z.tuple([
    z.union([stylelintValueSchema, z.json().array()]),
    stylelintOptionsSchema.optional(),
]) satisfies z.ZodType<Extract<TableSettings<'tools.stylelint'>['rules'][string], unknown[]>>;

export const stylelintRulesSchema = buildRuleTableSchema(
    z.record(nonemptyStringSchema, z.union([stylelintValueSchema, stylelintTupleSchema])),
    'css/stylelint',
) satisfies z.ZodType<TableSettings<'tools.stylelint'>['rules']>;
