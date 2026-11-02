import { z } from 'zod';
import { posix } from 'node:path';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers.ts';
import { outputSchema, commandCheckFields } from '#cli/schemas/manifests/checks.ts';

import {
    levelSchema,
    regexSchema,
    conditionSchema,
    manifestToolSchema,
    nonemptyStringSchema,
    operatingSystemSchema,
    writtenNamingOverrideSchema,
} from '#cli/schemas/manifests/tools.ts';
import {
    GROUPS,
    CASE_NAMES,
    FILE_KINDS,
    CHECK_RUNS,
    CHECK_NEEDS,
    GSPOT_PATHS,
    NAME_PATTERN,
    IGNORE_COMMAND,
    NAMED_CATEGORIES,
    CHECK_CWD_VALUES,
    SETTING_LANGUAGES,
    RULE_FILE_PATTERN,
    SHIPPED_FILES_FOLDER,
} from '#cli/config/manifests.ts';

const pathContainerSchema = z.strictObject({
    open: z.string().min(1),
    close: z.string(),
    category: z.enum(NAMED_CATEGORIES),
});

const wordListSchema = z.strictObject({
    words: z.string().array(),
    categories: z.string().array().optional(),
    first_word: z.boolean().optional(),
});

const categoryCasesSchema = z.strictObject({ cases: z.enum(CASE_NAMES).array() });

const languageSchema = z.strictObject({ categories: z.record(z.string(), categoryCasesSchema) });

const fileKindSchema = z.enum(FILE_KINDS);

const stringsSchema = z.string().array().default([]);

const filesSchema = z.strictObject({
    extensions: stringsSchema,
    filenames: stringsSchema,
    tags: stringsSchema,
    paths: stringsSchema,
    languages: z.boolean().default(false),
    test_files: z.boolean().default(false),
    prettier_plugins: z.boolean().default(false),
    eslint_plugins: z.boolean().default(false),
    kinds: fileKindSchema.array().default(['source']),
});

const selectorSchema = z.strictObject({
    level: levelSchema.default('basic'),
    selector: z.string().min(1),
    message: z.string().min(1),
    files: z.string().min(1).array().min(1).optional(),
    paths_setting: z.string().min(1).optional(),
    dependencies: stringsSchema,
});

const pointerSchema = z.strictObject({
    path: z.string(),
    folders: z.string().min(1).array().min(1).optional(),
    body: z.string(),
    note: z.string().min(1).optional(),
    inherit: z.boolean().optional(),
    overrides: z.boolean().optional(),
});

const consumerNamesSchema = z
    .union([z.string().min(1), z.string().min(1).array().min(1)])
    .transform((names) => (typeof names === 'string' ? [names] : names))
    .default([]);

const configSchema = z
    .strictObject({
        level: levelSchema.optional(),
        target: z.string(),
        source: z.string().min(1).optional(),
        root: z.boolean().default(false),
        tool: consumerNamesSchema,
        check: consumerNamesSchema,
        pointer: pointerSchema.optional(),
        per_scope: z.boolean().default(false),
        references: stringsSchema,
    })
    .transform((config) => {
        if (config.pointer?.folders !== undefined)
            return {
                ...config,
                file: config.target,
                pointer: { ...config.pointer, folders: config.pointer.folders },
            };
        return {
            ...config,
            file: config.target,
            source: posix.join(SHIPPED_FILES_FOLDER, config.source ?? config.target),
        };
    });

const generatorOutputSchema = z.union([
    z.strictObject({ path: z.string() }).transform(({ path }) => ({ kind: 'path' as const, path })),
    z.strictObject({ pattern: z.string().min(1) }).transform(({ pattern }) => ({
        kind: 'pattern' as const,
        path: pattern,
    })),
    z.strictObject({ stdout: z.string() }).transform(({ stdout }) => ({
        kind: 'stdout' as const,
        path: stdout,
    })),
]);

const checkFieldsSchema = z.strictObject({
    ...commandCheckFields,
    output: outputSchema.optional(),
    name: z.string().regex(NAME_PATTERN),
    level: levelSchema.default('basic'),
    runs: z.enum(CHECK_RUNS).default('files'),
    generator_outputs: generatorOutputSchema.array().min(1).optional(),
    coverage_arguments: z.string().min(1).array().optional(),
    limits: z.union([nonemptyStringSchema.array(), z.record(nonemptyStringSchema, nonemptyStringSchema)]).optional(),
    limit_languages: z.enum(SETTING_LANGUAGES).array().optional(),
    run_in_copy: z.boolean().optional(),
    binary_files: z.boolean().optional(),
    symlink_files: z.boolean().optional(),
    env: z.record(z.string(), z.string()).optional(),
    instead_of: z.string().optional(),
    when: conditionSchema
        .pick({
            configuration: true,
            config_file: true,
            setting: true,
            dependencies: true,
            tags: true,
        })
        .partial()
        .optional(),
    needs: z.enum(CHECK_NEEDS).array().min(1).optional(),
    operating_systems: operatingSystemSchema.array().optional(),
    tool: z.union([z.string().min(1), z.string().min(1).array().min(1)]).optional(),
    files: filesSchema.optional(),
    cwd: z.enum(CHECK_CWD_VALUES).optional(),
    summary: nonemptyStringSchema,
    example: z.string().trim().min(1),
    why: nonemptyStringSchema,
    help: nonemptyStringSchema.refine((help) => !help.includes(IGNORE_COMMAND), {
        error: `A check's help gives the fix alone. Remove ${IGNORE_COMMAND}: gspot explain names it.`,
    }),
});

export const checkSchema = checkFieldsSchema.transform(({ tool, ...check }) => {
    const [first, ...others] = Array.isArray(tool) ? tool : [];
    const executable = Array.isArray(tool) ? first : tool;
    return {
        ...check,
        ...(executable !== undefined && { tool: executable }),
        ...(others.length > 0 && { secondary_tools: others }),
    };
});

const detectionSchema = z.strictObject({
    content: z.record(z.string().min(1), regexSchema).default({}),
    extensions: stringsSchema,
    filenames: stringsSchema,
    dependencies: stringsSchema,
    absent_dependencies: stringsSchema,
    runtimes: z.enum(JAVASCRIPT_RUNTIMES).array().default([]),
    tags: stringsSchema,
    paths: stringsSchema,
    project_files: stringsSchema,
});

const allLevelRulesSchema = z
    .string()
    .min(1)
    .array()
    .transform((rules) => new Set(rules));

const rulesOffSchema = z.strictObject({
    rules: z.string().min(1).array().min(1),
    reason: nonemptyStringSchema,
    files: z.string().min(1).array().min(1).optional(),
});

const clientEnvironmentSchema = z.strictObject({
    dependencies: stringsSchema,
    files: z.string().min(1).array().min(1),
    public_prefixes: z.string().min(1).array().min(1),
    allowed_names: z.string().min(1).array().optional(),
});

const forwardingFilesSchema = z.strictObject({
    files: z.string().min(1).array().min(1),
    reason: nonemptyStringSchema,
});

const exportNamesSchema = z.strictObject({
    files: z.string().min(1).array().min(1),
    names: z.string().min(1).array().min(1),
});

const commitlintTableSchema = z.strictObject({ rules: z.record(z.string(), z.json().array()).default({}) });

const namingTableSchema = z.strictObject({
    path_containers: pathContainerSchema.array().default([]),
    lists: z
        .object({ folders: wordListSchema })
        .catchall(wordListSchema)
        .default({ folders: { words: [] } }),
    allowed_names: z.string().array().default([]),
    allowed_phrases: z.string().array().default([]),
    languages: z.record(z.string(), languageSchema).default({}),
    override: writtenNamingOverrideSchema.array().default([]),
});

export const manifestSchema = z
    .strictObject({
        folder: z.string(),
        defaults: z.record(z.string().min(1), z.json()).default({}),
        commitlint: commitlintTableSchema.prefault({}),
        eslint: z
            .strictObject({
                all_level_rules: allLevelRulesSchema.prefault([]),
                selectors: selectorSchema.array().default([]),
                rules_off: rulesOffSchema.array().default([]),
                export_names: exportNamesSchema.array().default([]),
                forwarding_files: forwardingFilesSchema.array().default([]),
                client_environment: clientEnvironmentSchema.array().default([]),
                required_tools: z.string().min(1).array().default([]),
            })
            .prefault({}),
        shared_prefixes: z.strictObject({ prefixes: stringsSchema, kinds: stringsSchema }).prefault({}),
        ignored_paths: z.string().min(1).array().default([]),
        route_files: z.string().min(1).array().default([]),
        generated: z.string().min(1).array().default([]),
        allowed_words: stringsSchema,
        ci_setup: z.string().min(1).array().array().default([]),
        configuration: z.strictObject({
            name: z.string().regex(NAME_PATTERN),
            group: z.enum(GROUPS),
            title: z.string(),
            requires: stringsSchema,
            suggests: stringsSchema,
            always_selected: z.boolean().default(false),
            description: nonemptyStringSchema,
        }),
        detect: detectionSchema.optional(),
        files: filesSchema.prefault({}),
        tool: manifestToolSchema.array().default([]),
        config_file: configSchema.array().default([]),
        check: checkSchema.array().default([]),
        naming: namingTableSchema.optional(),
        rules: z
            .record(
                z.string().regex(RULE_FILE_PATTERN),
                conditionSchema
                    .pick({
                        dependencies: true,
                        absent_dependencies: true,
                        filenames: true,
                        tags: true,
                        runtimes: true,
                    })
                    .partial()
                    .pipe(detectionSchema),
            )
            .default({}),
        ruff: z.strictObject({ basic: stringsSchema, all: stringsSchema }).prefault({}),
    })
    .transform(({ tool, config_file: configs, check, detect, ...rest }) => ({
        ...rest,
        detect: detect ?? detectionSchema.strip().parse(rest.files),
        tools: tool,
        configs: configs.map((config) => ({
            ...config,
            target: config.root
                ? config.file
                : posix.join(
                      GSPOT_PATHS.configurations,
                      rest.configuration.group,
                      rest.configuration.name,
                      config.file,
                  ),
        })),
        checks: check.map(({ name, ...fields }) => ({ ...fields, id: `${rest.configuration.name}/${name}` })),
    }));
