import { z } from 'zod';
import { reasoned } from '#cli/policy/schema/fields.ts';
import { licenseExceptionSchema } from '#cli/parsers/schema/licenses.ts';
import { ESLINT_WARN, ESLINT_ERROR } from '#cli/config/parsers/output.ts';
import ESLINT_RUNTIMES from '../../../configurations/language/javascript/runtime-names.json' with { type: 'json' };

const extraTable = z.object({ reason: z.string().optional() }).catchall(z.unknown());

const toolTable = z.object({ verbatim: extraTable.optional() }).catchall(z.unknown());

const ruleSeverity = z.union([
    z.literal('off'),
    z.literal(0),
    z.literal('warn'),
    z.literal('error'),
    z.literal(ESLINT_WARN),
    z.literal(ESLINT_ERROR),
]);

const ruleOption = z.union([ruleSeverity, z.tuple([ruleSeverity]).rest(z.unknown())]);

const eslintRules = z.record(z.string(), ruleOption);

const stylelintValue = z.union([z.literal(true), z.string().min(1), z.number(), z.record(z.string(), z.json())]);

const stylelintRules = z.record(
    z.string().min(1),
    z.union([stylelintValue, z.tuple([z.union([stylelintValue, z.array(z.json())])]).rest(z.json())]),
);

const eslintTable = toolTable.extend({
    runtimes: z.record(z.string().min(1), z.enum(ESLINT_RUNTIMES)).optional(),
    script_files: z.array(z.string().min(1)).optional(),
    rules: eslintRules.optional(),
    overrides: z.array(z.strictObject({ paths: z.array(z.string().min(1)).min(1), rules: eslintRules })).optional(),
});

export const licenseSettingsSchema = toolTable.extend({
    allowed: z.array(z.string().min(1)).optional(),
    exceptions: z.array(licenseExceptionSchema).optional(),
});

export const toolsSchema = z
    .object({
        eslint: eslintTable.optional(),
        stylelint: toolTable.extend({ rules: stylelintRules.optional() }).optional(),
        squawk: toolTable.extend({ assume_in_transaction: reasoned(z.boolean()).optional() }).optional(),
        jest: toolTable
            .extend({
                coverage: z
                    .strictObject({
                        lines: reasoned(z.number()).optional(),
                        branches: reasoned(z.number()).optional(),
                        functions: reasoned(z.number()).optional(),
                        statements: reasoned(z.number()).optional(),
                    })
                    .optional(),
                globals_module: z.string().min(1).optional(),
            })
            .optional(),
        prettier: toolTable.extend({ exclude: z.array(z.string()).optional() }).optional(),
    })
    .catchall(toolTable);
