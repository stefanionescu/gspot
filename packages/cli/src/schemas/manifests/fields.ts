import { z } from 'zod';
import { LEVELS, STAGES } from '#cli/config/manifests/names.ts';
import { outputSchema } from '#cli/schemas/manifests/output.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/projects/dependencies.ts';
import { MAX_EXIT_CODE, VALID_UNICODE_MESSAGE, DEFAULT_OUTPUT_FORMAT } from '#cli/config/manifests/fields.ts';

const findingExitCodesSchema = z.number().int().min(1).max(MAX_EXIT_CODE).array();

export const nonemptyStringSchema = z.string().min(1);

export const checkStageSchema = z.enum(STAGES);

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
        context.addIssue({ code: 'custom', message: VALID_UNICODE_MESSAGE });
    }
});

export const levelSchema = z.enum(LEVELS);

export const operatingSystemSchema = z.enum(OPERATING_SYSTEMS.map((system) => system.name));

export const conditionSchema = z.strictObject({
    configuration: z.string().min(1),
    config_file: z.string().min(1),
    level: levelSchema,
    setting: z.string().min(1),
    git: z.literal(true),
    dependencies: z.string().min(1).array().min(1),
    absent_dependencies: z.string().min(1).array().min(1),
    filenames: z.string().min(1).array().min(1),
    tags: z.string().min(1).array().min(1),
    runtimes: z.enum(JAVASCRIPT_RUNTIMES).array().min(1),
});

export const commandCheckFields = {
    command: commandSchema.optional(),
    stage: checkStageSchema,
    summary: z.string().optional(),
    help: z.string().optional(),
    fix: commandSchema.optional(),
    exit_codes: findingExitCodesSchema.optional(),
    output: outputSchema.default(DEFAULT_OUTPUT_FORMAT),
};
