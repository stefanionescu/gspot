import { z } from 'zod';
import semver from 'semver';
import type { SchemaShape } from '#cli/types/objects.ts';
import { outputSchema } from '#cli/parsers/output/formats.ts';
import { FILE_KINDS } from '#cli/config/repository/inventory.ts';
import type { PathContainer } from '#cli/types/checks/general.ts';
import type { FileKind } from '#cli/types/repository/inventory.ts';
import { DEFAULT_OUTPUT_FORMAT } from '#cli/config/parsers/output.ts';
import { NAMED_CATEGORIES } from '#cli/config/checks/general/naming.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependency-files.ts';
import { LEVELS, STAGES, VERSION_FLOOR, MAX_EXIT_CODE } from '#cli/config/configurations.ts';
import type { Level, Stage, CheckInput, ParsedCheck, ConditionFields } from '#cli/types/configurations.ts';

const findingExitCodesSchema = z.array(z.number().int().min(1).max(MAX_EXIT_CODE));

/** The stages supported by declared checks; custom commands exclude the message stage. */
export const checkStageSchema = z.enum(STAGES) satisfies z.ZodType<Stage>;

/** Argument vectors require an executable and preserve empty arguments after it. */
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

/** floors normalize at the manifest boundary before version comparisons. */
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
    value: z.union([z.string(), z.number(), z.boolean()]),
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
    >,
    { [Key in 'command' | 'summary' | 'help' | 'fix' | 'exit_codes']?: CheckInput[Key] | undefined } & Pick<
        CheckInput,
        'stage' | 'output'
    >
>;
