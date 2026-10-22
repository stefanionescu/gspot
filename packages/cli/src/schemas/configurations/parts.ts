import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { DEFAULT_OUTPUT_FORMAT } from '#cli/config/runs/output.ts';
import { outputSchema } from '#cli/schemas/configurations/output.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependencies.ts';
import { LEVELS, STAGES, MAX_EXIT_CODE } from '#cli/config/configurations.ts';
import type { Level, Stage, ParsedCheck, ConditionFields } from '#cli/types/configurations.ts';

const findingExitCodesSchema = z.array(z.number().int().min(1).max(MAX_EXIT_CODE));

export const nonemptyString = z.string().min(1);

/** The stages that a check runs at. A [[command_check]] cannot use the message stage. */
export const checkStageSchema = z.enum(STAGES) satisfies z.ZodType<Stage>;

/** Arguments need an executable first, and keep empty arguments after it. */
export const commandSchema = z
    .array(z.string())
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
    dependencies: z.array(z.string().min(1)).min(1),
    absent_dependencies: z.array(z.string().min(1)).min(1),
    filenames: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string().min(1)).min(1),
    runtimes: z.array(z.enum(JAVASCRIPT_RUNTIMES)).min(1),
} satisfies SchemaShape<ConditionFields>);

/** Fields that shipped checks and your own command checks share. */
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
