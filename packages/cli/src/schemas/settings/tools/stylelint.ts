import { z } from 'zod';
import { buildRuleTableSchema } from '#cli/schemas/settings/tools/rules.ts';
import { nonemptyStringSchema } from '#cli/schemas/configurations/fields.ts';

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
