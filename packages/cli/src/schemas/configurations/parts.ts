import { z } from 'zod';
import semver from 'semver';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { NAMED_CATEGORIES } from '#cli/config/checks/naming.ts';
import { FILE_KINDS } from '#cli/config/repository/inventory.ts';
import type { PathContainer } from '#cli/types/checks/naming.ts';
import { DEFAULT_OUTPUT_FORMAT } from '#cli/config/runs/output.ts';
import type { FileKind } from '#cli/types/repository/inventory.ts';
import { outputSchema } from '#cli/schemas/configurations/output.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependencies.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import { LEVELS, STAGES, VERSION_FLOOR, MAX_EXIT_CODE } from '#cli/config/configurations.ts';
import type { Level, Stage, ParsedCheck, ConditionFields } from '#cli/types/configurations.ts';

const findingExitCodesSchema = z.array(z.number().int().min(1).max(MAX_EXIT_CODE));

export const nonemptyString = z.string().min(1);

/** The stages of tool checks. Command checks cannot use the message stage. */
export const checkStageSchema = z.enum(STAGES) satisfies z.ZodType<Stage>;

/** Arguments need an executable first, and keep empty arguments after it. */
export const commandSchema = z
    .array(z.string())
    .min(1)
    .refine((command) => command[0] !== '', { message: 'The executable cannot be empty.', path: [0] })
    .meta({ prefixItems: [{ type: 'string', minLength: 1 }] });

/** Framework punctuation around a named path segment. */
export const pathContainerSchema = z.strictObject({
    open: z.string().min(1),
    close: z.string(),
    category: z.enum(NAMED_CATEGORIES),
} satisfies SchemaShape<PathContainer>);

/** Normalize version floors when gspot reads the manifest, before any version comparison. */
export const versionFloorSchema = z
    .string()
    .regex(VERSION_FLOOR)
    .transform((floor, context) => {
        const version = semver.coerce(floor);
        if (version === null) {
            context.addIssue({ code: 'custom', message: 'Use a numeric minimum version.' });
            return z.NEVER;
        }
        return version.version;
    }) satisfies z.ZodType<string>;

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

export const fileKindSchema = z.enum(FILE_KINDS) satisfies z.ZodType<FileKind>;

/** Fields shared by shipped checks and your own command checks. */
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
