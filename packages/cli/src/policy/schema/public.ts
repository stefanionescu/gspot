import { z } from 'zod';
import { namingLists } from '#cli/parsers/schema/naming.ts';
import { compact, valueAt } from '#cli/platform/contracts.ts';
import type { AuthoredReasons } from '#cli/types/policy/settings.ts';
import { architectureSchema } from '#cli/policy/schema/architecture.ts';
import { vendoredSchema, generatedSchema } from '#cli/parsers/schema/inventory.ts';
import { agentRulesSchema, agentRulesValuesSchema } from '#cli/policy/schema/agent-rules.ts';
import { publicToolsSchema, configurationSettingSchemas } from '#cli/policy/schema/native/contracts.ts';
import { LEVEL_SUMMARY, ALL_LEVEL_SUMMARY, DEFAULT_TEST_PATTERNS } from '#cli/config/policy/settings.ts';
import { commandSchema, checkStageSchema, findingExitCodesSchema } from '#cli/parsers/schema/command.ts';
import { levelSchema, outputSchema, runnerSchema, operatingSystemSchema } from '#cli/parsers/schema/contracts.ts';

import {
    defaultValue,
    formatSchema,
    relativePath,
    authoredDefault,
    localDateSchema,
    limitTableSchema,
    namingCategorySchema,
} from '#cli/policy/schema/contracts.ts';

const limitValue = z.union([limitTableSchema.valueType, limitTableSchema]);

const limitsSchema = z.record(z.string(), limitValue);

const namingLanguage = z.object(namingCategorySchema.shape).catchall(namingCategorySchema);

const structureSchema = z.strictObject({
    reexports: authoredDefault(z.enum(['none', 'index-only']).default('none')),
});

// The package manager install settings the dependencies configuration writes into the install configuration.
const dependenciesSchema = z.strictObject({
    min_release_age_days: z.number().optional(),
    scanner: z.string().optional(),
    registry_hosts: z.array(z.string().min(1)).optional(),
});

const ignoreSchema = z.strictObject({
    check: z.string(),
    rule: z.string().optional(),
    paths: z.array(z.string().meta({ pathRole: 'source' })).optional(),
    reason: z.string().optional(),
    until: localDateSchema
        .optional()
        .meta({ description: 'Stop applying this ignore on this date, in YYYY-MM-DD format (UTC).' }),
});

const checkSchema = z.strictObject({
    command: commandSchema.describe('The executable and arguments to run on selected files.'),
    paths: z
        .array(z.string().min(1).meta({ pathRole: 'source' }))
        .min(1)
        .meta({ description: 'Repository-relative glob patterns selecting inputs.' }),
    stage: checkStageSchema.exclude(['message']).meta({ description: 'The earliest stage that runs this check.' }),
    ignore_file: z
        .string()
        .optional()
        .meta({ description: 'A repository-relative file containing ordered gitignore patterns for this check.' })
        .meta({ pathRole: 'source' }),
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
    enabled: authoredDefault(z.boolean().default(false)).describe('Install and run the configured Git hooks.'),
    push_files: authoredDefault(z.enum(['changed', 'all']).default('changed')).meta({
        description: 'Check affected paths or the full tree of each pushed revision.',
    }),
});

const namingSchema = namingLists.partial().catchall(namingLanguage);

const scopeBody = {
    reasons: z.record(z.string().min(1), z.string()).optional(),
    ...configurationSettingSchemas,
    limits: limitsSchema.optional(),
    naming: namingSchema.optional(),
    architecture: architectureSchema.optional(),
    structure: structureSchema.optional(),
    tools: publicToolsSchema.optional(),
    format: formatSchema.optional(),
    dependencies: dependenciesSchema.optional(),
    tool_timeout_seconds: z.number().optional(),
};

const ciSchema = z.strictObject({
    setup: commandSchema
        .optional()
        .meta({ description: 'Executable and arguments to prepare the project before gspot installs its tools.' }),
    provider: z.enum(['github', 'gitlab']).meta({ description: 'The CI provider that receives generated jobs.' }),
    platforms: authoredDefault(z.array(operatingSystemSchema).min(1).default(['linux'])).meta({
        description: 'Platforms for GitHub check and manual jobs.',
    }),
    files: authoredDefault(z.enum(['changed', 'all']).default('changed')).meta({
        description: 'Check changed inputs or the full checked-out tree in CI.',
    }),
});

/** Native table defaults resolved once, without altering authored policy presence. */
export const policyTableValuesSchema = z
    .strictObject({
        agent_rules: agentRulesValuesSchema,
        hooks: hooksSchema
            .transform((raw) => ({
                enabled: defaultValue(hooksSchema.shape.enabled, raw.enabled),
                push_files: defaultValue(hooksSchema.shape.push_files, raw.push_files),
            }))
            .optional(),
        ci: ciSchema
            .transform((raw) => ({
                ...raw,
                platforms: defaultValue(ciSchema.shape.platforms, raw.platforms),
                files: defaultValue(ciSchema.shape.files, raw.files),
            }))
            .optional(),
    })
    .transform(compact);

/** The [hooks], [ci], and [agent_rules] fields as dotted settings; fields without defaults are optional. */
export const tableSettingSchemas = Object.fromEntries(
    Object.entries({ hooks: hooksSchema, ci: ciSchema, agent_rules: agentRulesSchema }).flatMap(([section, schema]) =>
        Object.entries<z.ZodType>(schema.shape).map(
            ([key, field]) =>
                [
                    `${section}.${key}`,
                    field.safeParse(undefined).success ? field : field.optional().describe(field.description ?? ''),
                ] as const,
        ),
    ),
);

/** One scope map value: its manual configuration choices and authored concern tables. */
export const scopeSchema = z.strictObject({
    configurations: z.array(z.string()).optional(),
    removed_configurations: z.array(z.string()).optional(),
    test_files: z.array(relativePath).optional(),
    ...scopeBody,
});

/** Top-level gspot.toml keys shown by gspot list settings and the settings reference. */
export const rootSettingSchemas = {
    level: authoredDefault(levelSchema.default('recommended')).meta({
        description: `${LEVEL_SUMMARY} ${ALL_LEVEL_SUMMARY}`,
    }),
    words: authoredDefault(z.record(z.string().min(1), z.string()).default({})).describe(
        'Accepted words and the reason for each spelling.',
    ),
    removed_configurations: authoredDefault(z.array(z.string()).default([])).describe(
        'Manual configuration removals retained through re-detection.',
    ),
    runner: runnerSchema.optional().meta({ description: 'The runner that installs and runs gspot.' }),
    test_files: authoredDefault(z.array(relativePath).default(DEFAULT_TEST_PATTERNS)).meta({
        description: 'Test files where applicable linters relax rules intended for production source.',
    }),
    exclude: authoredDefault(z.array(z.string().meta({ pathRole: 'source' })).default([])).meta({
        description: 'Paths and directory patterns excluded before reading source content.',
    }),
    generated: authoredDefault(z.array(generatedSchema).default([])).meta({
        description: 'Generated files excluded from source checks.',
    }),
    vendored: authoredDefault(z.array(vendoredSchema).default([])).meta({
        description: 'Upstream files excluded from source checks.',
    }),
};

export const policySchema = z
    .strictObject({
        ...rootSettingSchemas,
        configurations: z.array(z.string()).optional(),
        scope: z.record(relativePath, scopeSchema).optional(),
        ...scopeBody,
        ignore: z.array(ignoreSchema).optional(),
        check: z.record(z.string().min(1), checkSchema).optional(),
        hooks: hooksSchema.optional(),
        ci: ciSchema.optional(),
        agent_rules: authoredDefault(agentRulesSchema.default({})),
    })
    .superRefine(validateAuthoredReasons)
    .meta({
        examples: [
            { level: 'recommended' },
            { configurations: ['typescript', 'nextjs', 'markdown'] },
            { runner: 'mise' },
            { test_files: ['tests/**/*.test.ts'] },
            { exclude: ['dist/**'], reasons: { exclude: 'Build outputs have their own generated checks.' } },
            { scope: { 'services/api': { configurations: ['python', 'fastapi'] } } },
            { configurations: ['typescript', 'python'], limits: { function_lines: 60, python: { file_lines: 300 } } },
            {
                configurations: ['naming'],
                naming: {
                    overrides: [
                        {
                            paths: ['migrations/**'],
                            allow_digits: true,
                            reason: 'Migration filenames begin with their version.',
                        },
                    ],
                },
            },
            { architecture: { roles: { runtime: ['src/**'], tests: ['tests/**'] } } },
            {
                structure: { reexports: 'index-only' },
                reasons: { 'structure.reexports': 'Libraries expose a reviewed public index.' },
            },
            {
                configurations: ['javascript'],
                tools: { eslint: { rules: { 'no-console': [{ allow: ['warn'] }] } } },
                reasons: { 'tools.eslint.rules.no-console': 'Scripts print reviewed warnings to the terminal.' },
            },
            { format: { indent_width: 4, print_width: 100 } },
            { dependencies: { min_release_age_days: 7 } },
            { words: { Acme: 'The project uses this product name.' } },
            { licenses: { allowed: ['MIT', 'Apache-2.0'] } },
            {
                ignore: [
                    {
                        check: 'javascript/eslint',
                        rule: 'no-console',
                        paths: ['scripts/**'],
                        reason: 'Scripts print their results.',
                    },
                ],
            },
            {
                check: {
                    'project/notes': {
                        command: ['node', 'scripts/check-notes.mjs', '{files}'],
                        paths: ['notes/**'],
                        stage: 'commit',
                        ignore_file: '.notesignore',
                    },
                },
            },
            { hooks: { enabled: true, push_files: 'all' } },
            { ci: { provider: 'github', platforms: ['linux'], files: 'changed' } },
            { agent_rules: { enabled: true, instruction_files: ['.github/copilot-instructions.md'] } },
            { tool_timeout_seconds: 300 },
            {
                generated: [
                    {
                        paths: ['src/generated/**'],
                        generator: 'API schema generator',
                        reason: 'The API schema owns these generated sources.',
                    },
                ],
            },
            { vendored: [{ paths: ['vendor/**'], reason: 'Copied from the reviewed upstream library.' }] },
        ],
    });

/**
 * Refuse explanations whose setting is absent from the same authored table.
 * @param raw the authored values, before execution defaults
 * @param context the native schema issue collector
 */
export function validateAuthoredReasons(raw: AuthoredReasons, context: z.RefinementCtx): void {
    const tables = [
        { table: raw, path: [] },
        ...(raw.scope === undefined ? [] : Object.entries(raw.scope)).map(([scope, table]) => ({
            table,
            path: ['scope', scope],
        })),
    ];
    for (const { table, path } of tables) {
        if (table.reasons === undefined) continue;
        const orphaned = Object.keys(table.reasons).filter((key) => valueAt(table, key.split('.')) === undefined);
        for (const key of orphaned)
            context.addIssue({
                code: 'custom',
                path: [...path, 'reasons', key],
                message: `The reason for ${key} has no setting written in this table.`,
            });
    }
}
