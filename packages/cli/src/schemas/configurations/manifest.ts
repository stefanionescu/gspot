import { z } from 'zod';
import { posix } from 'node:path';
import { FILE_KINDS } from '#cli/config/files/kinds.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { FileKind } from '#cli/types/repository/files.ts';
import { manifestToolSchema } from '#cli/schemas/configurations/tool.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/projects/dependencies.ts';
import { writtenNamingOverrideSchema } from '#cli/schemas/configurations/naming.ts';
import { NAME_PATTERN, RULE_FILE_PATTERN } from '#cli/config/configurations/manifest.ts';

import type {
    ConfigFile,
    ParsedCheck,
    ParsedManifest,
    ConditionFields,
    GeneratorOutput,
} from '#cli/types/configurations.ts';
import {
    GROUPS,
    CHECK_RUNS,
    CHECK_NEEDS,
    CHECK_WORKING_FOLDERS,
    SHIPPED_CONFIG_FILES_FOLDER,
} from '#cli/config/configurations/names.ts';
import {
    levelSchema,
    regexSchema,
    nonemptyString,
    conditionSchema,
    commandCheckFields,
    operatingSystemSchema,
} from '#cli/schemas/configurations/fields.ts';

const fileKindSchema = z.enum(FILE_KINDS) satisfies z.ZodType<FileKind>;

const optionalStringList = z.string().array().default([]) satisfies z.ZodType<string[]>;

const filesSchema = z.strictObject({
    extensions: optionalStringList,
    filenames: optionalStringList,
    tags: optionalStringList,
    paths: optionalStringList,
    languages: z.boolean().default(false),
    prettier_plugins: z.boolean().default(false),
    eslint_plugins: z.boolean().default(false),
    kinds: fileKindSchema.array().default(['source']),
} satisfies SchemaShape<ParsedManifest['files']>);

const selectorSchema = z.strictObject({
    level: levelSchema.default('recommended'),
    selector: z.string().min(1),
    message: z.string().min(1),
    paths_setting: z.string().min(1).optional(),
} satisfies SchemaShape<ParsedManifest['eslint']['selectors'][number]>);

const pointerSchema = z.strictObject({
    path: z.string(),
    folders: z.string().min(1).array().min(1).optional(),
    body: z.string(),
    note: z.string().min(1).optional(),
    inherit: z.boolean().optional(),
} satisfies SchemaShape<NonNullable<ConfigFile['pointer']>>);

const consumerNamesSchema = z
    .union([z.string().min(1), z.string().min(1).array().min(1)])
    .transform((names) => (typeof names === 'string' ? [names] : names))
    .default([]) satisfies z.ZodType<string[], string | string[] | undefined>;

const configFileSchema = z
    .strictObject({
        level: levelSchema.optional(),
        target: z.string(),
        source: z.string().min(1).optional(),
        root: z.boolean().default(false),
        tool: consumerNamesSchema,
        check: consumerNamesSchema,
        pointer: pointerSchema.optional(),
        per_scope: z.boolean().default(false),
        rule_dependencies: z.record(z.string().min(1), z.string().min(1).array().min(1)).optional(),
        paths_setting: z.string().min(1).optional(),
    })
    .transform((configFile) => {
        if (configFile.pointer?.folders !== undefined)
            return {
                ...configFile,
                file: configFile.target,
                pointer: { ...configFile.pointer, folders: configFile.pointer.folders },
            };
        return {
            ...configFile,
            file: configFile.target,
            source: posix.join(SHIPPED_CONFIG_FILES_FOLDER, configFile.source ?? configFile.target),
        };
    }) satisfies z.ZodType<ConfigFile>;
const generatorOutputSchema = z.union([
    z
        .strictObject({ path: z.string() })
        .transform(({ path }) => ({ kind: 'path' as const, path })) satisfies z.ZodType<GeneratorOutput>,
    z.strictObject({ pattern: z.string().min(1) }).transform(({ pattern }) => ({
        kind: 'pattern' as const,
        path: pattern,
    })) satisfies z.ZodType<GeneratorOutput>,
    z.strictObject({ stdout: z.string() }).transform(({ stdout }) => ({
        kind: 'stdout' as const,
        path: stdout,
    })) satisfies z.ZodType<GeneratorOutput>,
]) satisfies z.ZodType<GeneratorOutput>;

const checkFields = z.strictObject({
    ...commandCheckFields,
    name: z.string().regex(NAME_PATTERN),
    level: levelSchema,
    runs: z.enum(CHECK_RUNS).default('files'),
    generator_outputs: generatorOutputSchema.array().min(1).optional(),
    coverage_arguments: z.string().min(1).array().optional(),
    run_in_copy: z.boolean().optional(),
    env: z.record(z.string(), z.string()).optional(),
    instead_of: z.string().optional(),
    when: (
        conditionSchema.pick({
            configuration: true,
            setting: true,
            git: true,
            dependencies: true,
            tags: true,
        }) satisfies z.ZodType<Pick<ConditionFields, 'configuration' | 'setting' | 'git' | 'dependencies' | 'tags'>>
    )
        .partial()
        .optional(),
    needs: z.enum(CHECK_NEEDS).array().min(1).optional(),
    operating_systems: operatingSystemSchema.array().optional(),
    tool: z.union([z.string().min(1), z.string().min(1).array().min(1)]).optional(),
    files: filesSchema.optional(),
    cwd: z.enum(CHECK_WORKING_FOLDERS).optional(),
    summary: nonemptyString,
    example: z.string().trim().min(1),
    why: nonemptyString,
    help: nonemptyString,
} satisfies SchemaShape<Omit<ParsedCheck, 'tool' | 'other_tools'> & { tool?: string | string[] | undefined }>);

const checkSchema = checkFields.transform(({ tool, ...check }) => {
    const [first, ...others] = Array.isArray(tool) ? tool : [];
    const executable = Array.isArray(tool) ? first : tool;
    return {
        ...check,
        ...(executable !== undefined && { tool: executable }),
        ...(others.length > 0 && { other_tools: others }),
    };
}) satisfies z.ZodType<ParsedCheck>;

const detectionSchema = z.strictObject({
    content: z.record(z.string().min(1), regexSchema).default({}),
    extensions: optionalStringList,
    filenames: optionalStringList,
    dependencies: optionalStringList,
    absent_dependencies: optionalStringList,
    shebangs: optionalStringList,
    runtimes: z.enum(JAVASCRIPT_RUNTIMES).array().default([]),
    tags: optionalStringList,
    paths: optionalStringList,
    project_files: optionalStringList,
} satisfies SchemaShape<ParsedManifest['detect']>);

const allLevelRulesSchema = z
    .string()
    .min(1)
    .array()
    .transform((rules) => new Set(rules)) satisfies z.ZodType<Set<string>>;
const rulesOffSchema = z.strictObject({
    rules: z.string().min(1).array().min(1),
    reason: nonemptyString,
    files: z.string().min(1).array().min(1).optional(),
} satisfies SchemaShape<ParsedManifest['eslint']['rules_off'][number]>);

export const manifestSchema = z
    .strictObject({
        folder: z.string(),
        defaults: z.record(z.string().min(1), z.json()).default({}),
        eslint: z
            .strictObject({
                all_level_rules: allLevelRulesSchema.prefault([]),
                selectors: selectorSchema.array().default([]),
                rules_off: rulesOffSchema.array().default([]),
                required_tools: z.string().min(1).array().default([]),
            } satisfies SchemaShape<ParsedManifest['eslint']>)
            .prefault({}),
        shared_prefixes: z
            .strictObject({ prefixes: optionalStringList, kinds: optionalStringList } satisfies SchemaShape<
                ParsedManifest['shared_prefixes']
            >)
            .prefault({}),
        ignored_paths: z.string().min(1).array().default([]),
        route_files: z.string().min(1).array().default([]),
        generated: z.string().min(1).array().default([]),
        allowed_words: optionalStringList,
        configuration: z.strictObject({
            name: z.string().regex(NAME_PATTERN),
            group: z.enum(GROUPS),
            title: z.string(),
            requires: optionalStringList,
            suggests: optionalStringList,
            always_selected: z.boolean().default(false),
            when: (conditionSchema.pick({ git: true }) satisfies z.ZodType<Pick<ConditionFields, 'git'>>).optional(),
            description: nonemptyString,
        } satisfies SchemaShape<ParsedManifest['configuration']>),
        detect: detectionSchema.optional(),
        files: filesSchema.prefault({}),
        tool: manifestToolSchema.array().default([]),
        config_file: configFileSchema.array().default([]),
        check: checkSchema.array().default([]),
        naming: z
            .strictObject({
                override: writtenNamingOverrideSchema.array().default([]),
            } satisfies SchemaShape<NonNullable<ParsedManifest['naming']>>)
            .optional(),
        rules: z
            .record(
                z.string().regex(RULE_FILE_PATTERN),
                (
                    conditionSchema.pick({
                        dependencies: true,
                        absent_dependencies: true,
                        filenames: true,
                        tags: true,
                        runtimes: true,
                    }) satisfies z.ZodType<
                        Pick<
                            ConditionFields,
                            'dependencies' | 'absent_dependencies' | 'filenames' | 'tags' | 'runtimes'
                        >
                    >
                )
                    .partial()
                    .pipe(detectionSchema),
            )
            .default({}),
        ruff: z
            .strictObject({ recommended: optionalStringList, all: optionalStringList } satisfies SchemaShape<
                ParsedManifest['ruff']
            >)
            .prefault({}),
    })
    .transform(({ tool, config_file: configFiles, check, detect, ...rest }) => ({
        ...rest,
        detect: detect ?? detectionSchema.strip().parse(rest.files),
        tools: tool,
        configFiles: configFiles.map((configFile) => ({
            ...configFile,
            target: configFile.root
                ? configFile.file
                : posix.join(
                      GSPOT_PATHS.configurations,
                      rest.configuration.group,
                      rest.configuration.name,
                      configFile.file,
                  ),
        })),
        checks: check.map(({ name, ...fields }) => ({ ...fields, id: `${rest.configuration.name}/${name}` })),
    })) satisfies z.ZodType<ParsedManifest>;
