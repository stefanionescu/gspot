import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { LEVELS, STAGES } from '#cli/config/configurations/names.ts';
import { outputSchema } from '#cli/schemas/configurations/output.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/projects/dependencies.ts';
import { MAX_EXIT_CODE, DEFAULT_OUTPUT_FORMAT } from '#cli/config/configurations/fields.ts';
import type { Level, Stage, ParsedCheck, ConditionFields } from '#cli/types/configurations.ts';

const findingExitCodesSchema = z.number().int().min(1).max(MAX_EXIT_CODE).array();

export const nonemptyString = z.string().min(1);

export const checkStageSchema = z.enum(STAGES) satisfies z.ZodType<Stage>;

export const commandSchema = z
    .string()
    .array()
    .min(1)
    .refine((command) => command[0] !== '', { message: 'The executable cannot be empty.', path: [0] })
    .meta({ prefixItems: [{ type: 'string', minLength: 1 }] });

export const regexSchema = z.string().superRefine((pattern, context) => {
    try {
        new RegExp(pattern, 'u');
    } catch {
        context.addIssue({ code: 'custom', message: 'Use a valid Unicode regular expression.' });
    }
});

export const levelSchema = z.enum(LEVELS) satisfies z.ZodType<Level>;

export const operatingSystemSchema = z.enum(OPERATING_SYSTEMS.map((system) => system.name)) satisfies z.ZodType<
    (typeof OPERATING_SYSTEMS)[number]['name']
>;

export const conditionSchema = z.strictObject({
    configuration: z.string().min(1),
    level: levelSchema,
    setting: z.string().min(1),
    git: z.literal(true),
    dependencies: z.string().min(1).array().min(1),
    absent_dependencies: z.string().min(1).array().min(1),
    filenames: z.string().min(1).array().min(1),
    tags: z.string().min(1).array().min(1),
    runtimes: z.enum(JAVASCRIPT_RUNTIMES).array().min(1),
} satisfies SchemaShape<ConditionFields>);

export const commandCheckFields = {
    command: commandSchema.optional(),
    stage: checkStageSchema,
    summary: z.string().optional(),
    help: z.string().optional(),
    fix: commandSchema.optional(),
    exit_codes: findingExitCodesSchema.optional(),
    output: outputSchema.default(DEFAULT_OUTPUT_FORMAT),
} satisfies SchemaShape<
    { [Key in 'command' | 'summary' | 'help' | 'fix' | 'exit_codes']?: ParsedCheck[Key] | undefined } & Pick<
        ParsedCheck,
        'stage' | 'output'
    >
>;
