import { z } from 'zod';
import { namingLists } from '#cli/parsers/schema/naming.ts';
import { relativePath } from '#cli/parsers/schema/paths.ts';
import { outputSchema } from '#cli/parsers/schema/output.ts';
import { agentRulesSchema } from '#cli/parsers/schema/agent-rules.ts';
import { reasoned, namingCategorySchema } from '#cli/policy/schema/fields.ts';
import { toolsSchema, licenseSettingsSchema } from '#cli/policy/schema/tools.ts';
import { configurationSettingSchemas } from '#cli/policy/schema/configurations.ts';
import { vendoredSchema, generatedSchema } from '#cli/parsers/schema/inventory.ts';
import { commandSchema, checkStageSchema, findingExitCodesSchema } from '#cli/parsers/schema/command.ts';
import { INDENT_MAX, PRINT_WIDTH_MAX, PRINT_WIDTH_MIN, DEFAULT_TEST_PATTERNS } from '#cli/config/policy/settings.ts';
import { levelSchema, runnerSchema, numberSettingSchema, operatingSystemSchema } from '#cli/parsers/schema/settings.ts';

const reasonedNumber = reasoned(z.number());

const groupedLimits = z.record(z.string(), reasonedNumber);

const limitValue = z.union([reasonedNumber, groupedLimits]);

const limitsSchema = z
    .object({ site: z.strictObject({ kilobytes: reasoned(z.array(z.unknown())).optional() }).optional() })
    .catchall(limitValue);

const namingLanguage = z.object(namingCategorySchema.shape).catchall(namingCategorySchema);

const element = z.strictObject({ name: z.string(), paths: z.array(z.string()) });

const allowedEdge = z.strictObject({ from: z.string(), to: z.array(z.string()), reason: z.string().optional() });

const roleGlobs = z.union([z.string(), z.array(z.string())]);

// The harness role names folders inside the scope, so it refuses a path that leaves it.
const roles = z.object({ test_support: z.union([relativePath, z.array(relativePath)]).optional() }).catchall(roleGlobs);

const architectureSchema = z.strictObject({
    modules: z.array(element).default([]),
    imports_allowed: z.array(allowedEdge).default([]),
    roles: roles.default({}),
});

const reasonedPaths = z.strictObject({ paths: z.array(z.string().min(1)).min(1), reason: z.string().optional() });

const singletonAllowance = z.strictObject({
    names: z.array(z.string().min(1)).min(1),
    paths: z.array(z.string().min(1)).min(1).optional(),
    reason: z.string().optional(),
});

const structureSchema = z.strictObject({
    reexports: z.enum(['none', 'index-only']).default('none'),
    lone_files_allowed: z.array(reasonedPaths).default([]),
    prefix_collisions_allowed: z.array(reasonedPaths).default([]),
    folder_names_allowed: z.array(reasonedPaths).default([]),
    python: z.strictObject({ singletons_allowed: z.array(singletonAllowance).optional() }).default({}),
});

const formatFields = z.strictObject({
    indent_style: z.enum(['space', 'tab']).optional(),
    indent_width: numberSettingSchema({ integer: true, minimum: 1, maximum: INDENT_MAX }).optional(),
    print_width: numberSettingSchema({ integer: true, minimum: PRINT_WIDTH_MIN, maximum: PRINT_WIDTH_MAX }).optional(),
    line_ending: z.enum(['lf', 'crlf']).optional(),
    final_newline: z.boolean().optional(),
    quotes: z.enum(['single', 'double']).optional(),
    trailing_commas: z.enum(['all', 'es5', 'none']).optional(),
    semicolons: z.boolean().optional(),
});

const formatOverride = formatFields
    .extend({ paths: z.array(z.string().min(1)).min(1) })
    .refine((entry) => Object.keys(entry).length > 1, {
        message: 'A format override needs at least one formatting option.',
    })
    .meta({ minProperties: 2 });

const formatSchema = formatFields.extend({ overrides: z.array(formatOverride).optional() });

// The package manager install settings the dependencies configuration writes into the install configuration.
const dependenciesSchema = z.strictObject({
    min_release_age_days: reasonedNumber.optional(),
    scanner: z.string().optional(),
});

const proseSchema = z.strictObject({ vocabulary: z.array(z.string()).default([]) });

const ignoreSchema = z.strictObject({
    check: z.string(),
    rule: z.string().optional(),
    paths: z.array(z.string()).optional(),
    reason: z.string().optional(),
    until: z.iso
        .date()
        .optional()
        .meta({ description: 'Stop applying this ignore on this date, in YYYY-MM-DD format (UTC).' }),
});

const checkSchema = z.strictObject({
    name: z.string().meta({ description: 'The unique identifier used by gspot check --only.' }),
    command: commandSchema.describe('The executable and arguments to run on selected files.'),
    paths: z
        .array(z.string().min(1))
        .min(1)
        .meta({ description: 'Repository-relative glob patterns selecting inputs.' }),
    stage: checkStageSchema.exclude(['message']).meta({ description: 'The earliest stage that runs this check.' }),
    ignore_file: z
        .string()
        .optional()
        .meta({ description: 'A repository-relative file containing ordered gitignore patterns for this check.' }),
    help: z.string().optional().meta({ description: 'Instructions for resolving findings.' }),
    fix: commandSchema.optional().describe('The executable and arguments that correct findings.'),
    exit_codes: findingExitCodesSchema
        .optional()
        .describe(
            'Native nonzero statuses that mean findings from command and fix. Other nonzero statuses mean execution failure.',
        ),
    finding_count_pattern: z
        .string()
        .optional()
        .meta({ description: 'A regular expression whose first capture group reports the finding count.' }),
    crash_pattern: z.string().optional().meta({
        description:
            'A multiline Unicode regular expression matching fatal tool diagnostics in stdout or stderr, for both command and fix.',
    }),
    needs: z
        .array(z.enum(['build', 'docker', 'network']))
        .min(1)
        .optional()
        .meta({ description: 'Capabilities that must be available before the command runs.' }),
    platforms: z
        .array(operatingSystemSchema)
        .optional()
        .meta({ description: 'Operating systems where the command is supported.' }),
    summary: z.string().optional().meta({ description: 'A short description shown in check listings.' }),
    output: outputSchema.optional().describe('The parser and location patterns used to read findings.'),
});

const hooksSchema = z.strictObject({
    push_files: z
        .enum(['changed', 'all'])
        .default('changed')
        .meta({ description: 'Check affected paths or the full tree of each pushed revision.' }),
});

const namingSchema = namingLists.partial().catchall(namingLanguage);

const scopeBody = {
    ...configurationSettingSchemas,
    licenses: licenseSettingsSchema.optional(),
    limits: limitsSchema.optional(),
    naming: namingSchema.optional(),
    architecture: architectureSchema.optional(),
    structure: structureSchema.optional(),
    tools: toolsSchema.optional(),
    format: formatSchema.optional(),
    dependencies: dependenciesSchema.optional(),
    tool_timeout_seconds: reasonedNumber.optional(),
};

const ciSchema = z.strictObject({
    provider: z.enum(['github', 'gitlab']).meta({ description: 'The CI provider that receives generated jobs.' }),
    platforms: z
        .array(operatingSystemSchema)
        .min(1)
        .default(['linux'])
        .meta({ description: 'Platforms for GitHub check and manual jobs.' }),
    files: z
        .enum(['changed', 'all'])
        .default('changed')
        .meta({ description: 'Check changed inputs or the full checked-out tree in CI.' }),
});

/** The [hooks], [ci], and [agent_rules] fields as dotted settings; fields without defaults are optional. */
export const tableSettingSchemas = Object.fromEntries(
    Object.entries({ hooks: hooksSchema, ci: ciSchema, agent_rules: agentRulesSchema }).flatMap(([section, schema]) =>
        Object.entries(schema.shape as Record<string, z.ZodType>).map(
            ([key, field]) =>
                [
                    `${section}.${key}`,
                    field.safeParse(undefined).success ? field : field.optional().describe(field.description ?? ''),
                ] as const,
        ),
    ),
);

/** One [[scope]] entry: its path, configurations, and the per-scope tables. */
export const scopeSchema = z.strictObject({
    path: relativePath,
    configurations: z.array(z.string()).optional(),
    tests: z.array(z.string()).optional(),
    ...scopeBody,
});

/** Top-level gspot.toml keys shown by gspot list settings and the settings reference. */
export const rootSettingSchemas = {
    level: levelSchema.default('recommended').meta({
        description:
            'Recommended includes correctness, security, accessibility, type safety, routine formatting, and declared contracts. All adds stable conventions. Neither enables experimental rules.',
    }),
    require_reasons: z
        .boolean()
        .default(false)
        .meta({ description: 'Require a reason for ignores and loosened settings.' }),
    extra_checks: z
        .array(z.string())
        .default([])
        .meta({ description: 'Checks at level all to run individually at level recommended.' }),
    run_with: runnerSchema.optional().meta({ description: 'The runner that installs and runs gspot.' }),
    tests: z
        .array(z.string())
        .default(DEFAULT_TEST_PATTERNS)
        .meta({ description: 'Test files where applicable linters relax rules intended for production source.' }),
    exclude: z
        .array(z.string())
        .default([])
        .meta({ description: 'Paths and directory patterns excluded before reading source content.' }),
    generated: z
        .array(generatedSchema)
        .default([])
        .meta({ description: 'Generated files excluded from source checks.' }),
    vendored: z.array(vendoredSchema).default([]).meta({ description: 'Upstream files excluded from source checks.' }),
};

export const policySchema = z.strictObject({
    ...rootSettingSchemas,
    configurations: z.array(z.string()).optional(),
    scope: z.array(scopeSchema).optional(),
    ...scopeBody,
    prose: proseSchema.optional(),
    ignore: z.array(ignoreSchema).optional(),
    check: z.array(checkSchema).optional(),
    hooks: hooksSchema.optional(),
    ci: ciSchema.optional(),
    agent_rules: agentRulesSchema.prefault({}),
});
