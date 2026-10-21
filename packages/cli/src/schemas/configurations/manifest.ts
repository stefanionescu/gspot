import { z } from 'zod';
import { posix } from 'node:path';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { FILE_KINDS } from '#cli/config/repository/inventory.ts';
import type { FileKind } from '#cli/types/repository/inventory.ts';
import { RULE_FILE_PATTERN } from '#cli/config/generation/rules.ts';
import { GSPOT_CONFIGURATIONS_PATH } from '#cli/config/gspot-paths.ts';
import { manifestToolSchema } from '#cli/schemas/configurations/tool.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependencies.ts';
import { declaredNamingOverrideSchema } from '#cli/schemas/configurations/naming.ts';

import type {
    ToolFile,
    ParsedCheck,
    ParsedManifest,
    ConditionFields,
    GeneratorOutput,
} from '#cli/types/configurations.ts';
import {
    GROUPS,
    CHECK_RUNS,
    CHECK_NEEDS,
    NAME_PATTERN,
    CHECK_WORKING_FOLDERS,
    SHIPPED_TOOL_FILES_FOLDER,
} from '#cli/config/configurations.ts';
import {
    levelSchema,
    regexSchema,
    nonemptyString,
    conditionSchema,
    commandCheckFields,
    operatingSystemSchema,
} from '#cli/schemas/configurations/parts.ts';

const fileKindSchema = z.enum(FILE_KINDS) satisfies z.ZodType<FileKind>;

const optionalStringList = z.array(z.string()).default([]);

const filesSchema = z.strictObject({
    extensions: optionalStringList,
    filenames: optionalStringList,
    tags: optionalStringList,
    paths: optionalStringList,
    languages: z.boolean().default(false),
    // The file types that the Prettier plugins of the configurations in use format, such as .astro, join the owned ones.
    prettier_plugins: z.boolean().default(false),
    // The file types that the ESLint plugins of the configurations in use lint, such as .vue, join the owned ones.
    eslint_plugins: z.boolean().default(false),
    kinds: z.array(fileKindSchema).default(['source']),
} satisfies SchemaShape<ParsedManifest['files']>);

// A syntax selector applies to every source file, or to the files that a setting lists.
const selectorSchema = z.strictObject({
    selector: z.string().min(1),
    message: z.string().min(1),
    files_setting: z.string().min(1).optional(),
} satisfies SchemaShape<ParsedManifest['eslint']['selectors'][number]>);

const pointerSchema = z.strictObject({
    path: z.string(),
    folders: z.array(z.string().min(1)).min(1).optional(),
    body: z.string(),
    note: z.string().min(1).optional(),
    inherit: z.boolean().optional(),
} satisfies SchemaShape<NonNullable<ToolFile['pointer']>>);

// A tool-file consumer accepts one declared name or a nonempty list of names.
const consumerNamesSchema = z
    .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
    .transform((names) => (typeof names === 'string' ? [names] : names))
    .default([]) satisfies z.ZodType<string[], string | string[] | undefined>;

const toolFileSchema = z
    .strictObject({
        level: levelSchema.optional(),
        target: z.string(),
        // A root file sits in the scope folder; every other tool file sits in the folder of its configuration.
        root: z.boolean().default(false),
        // Generate the file when a check in its scope runs any named tool.
        tool: consumerNamesSchema,
        check: consumerNamesSchema,
        pointer: pointerSchema.optional(),
        per_scope: z.boolean().default(false),
        rule_dependencies: z.record(z.string().min(1), z.array(z.string().min(1)).min(1)).optional(),
        rule_paths_setting: z.string().min(1).optional(),
    })
    // Copied files use the same relative path beneath tool-files and the generated configuration folder.
    .transform((toolFile) => {
        if (toolFile.pointer?.folders !== undefined)
            return {
                ...toolFile,
                file: toolFile.target,
                pointer: { ...toolFile.pointer, folders: toolFile.pointer.folders },
            };
        return { ...toolFile, file: toolFile.target, source: posix.join(SHIPPED_TOOL_FILES_FOLDER, toolFile.target) };
    }) satisfies z.ZodType<ToolFile>;

const checkFields = z.strictObject({
    ...commandCheckFields,
    // The name inside the configuration; the check ID joins the configuration name, a slash, and this name, as python/ruff.
    name: z.string().regex(NAME_PATTERN),
    level: levelSchema,
    runs: z.enum(CHECK_RUNS).default('files'),
    generator_outputs: z
        .array(
            z.union([
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
            ]),
        )
        .min(1)
        .optional(),
    coverage_arguments: z.array(z.string().min(1)).optional(),
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
    needs: z.array(z.enum(CHECK_NEEDS)).min(1).optional(),
    operating_systems: z.array(operatingSystemSchema).optional(),
    tool: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
    files: filesSchema.optional(),
    cwd: z.enum(CHECK_WORKING_FOLDERS).optional(),
    summary: nonemptyString,
    example: z.string().trim().min(1),
    why: nonemptyString,
    help: nonemptyString,
} satisfies SchemaShape<Omit<ParsedCheck, 'tool' | 'other_tools'> & { tool?: string | string[] | undefined }>);

// A check runs its command, or gspot runs it itself when the check registry names its ID. A list of tools names the
// tool the check runs, then the tools its command starts, such as the bash that runs Bats; each must work.
const checkSchema = checkFields.transform(({ tool, ...check }) => {
    const [first, ...others] = Array.isArray(tool) ? tool : [];
    const executable = Array.isArray(tool) ? first : tool;
    return {
        ...check,
        ...(executable === undefined ? {} : { tool: executable }),
        ...(others.length === 0 ? {} : { other_tools: others }),
    };
}) satisfies z.ZodType<ParsedCheck>;

const detectionSchema = z.strictObject({
    content: z.record(z.string().min(1), regexSchema).default({}),
    extensions: optionalStringList,
    filenames: optionalStringList,
    dependencies: optionalStringList,
    absent_dependencies: optionalStringList,
    shebangs: optionalStringList,
    runtimes: z.array(z.enum(JAVASCRIPT_RUNTIMES)).default([]),
    tags: optionalStringList,
    paths: optionalStringList,
    // A file, or a folder such as *.xcodeproj, whose folder contains a project: init proposes a scope there.
    project_files: optionalStringList,
} satisfies SchemaShape<ParsedManifest['detect']>);

const allLevelRulesSchema = z.array(z.string().min(1)).transform((rules) => new Set(rules)) satisfies z.ZodType<
    Set<string>
>;

// The shape of a configuration manifest.toml after validation.
export const manifestSchema = z
    .strictObject({
        folder: z.string(),
        defaults: z.record(z.string().min(1), z.json()).default({}),
        eslint: z
            .strictObject({
                all_level_rules: allLevelRulesSchema.prefault([]),
                selectors: z.array(selectorSchema).default([]),
                rules_off: z
                    .array(
                        z.strictObject({
                            rules: z.array(z.string().min(1)).min(1),
                            reason: nonemptyString,
                            files: z.array(z.string().min(1)).min(1).optional(),
                        } satisfies SchemaShape<ParsedManifest['eslint']['rules_off'][number]>),
                    )
                    .default([]),
                required_tools: z.array(z.string().min(1)).default([]),
            } satisfies SchemaShape<ParsedManifest['eslint']>)
            .prefault({}),
        shared_prefixes: z
            .strictObject({ prefixes: optionalStringList, kinds: optionalStringList } satisfies SchemaShape<
                ParsedManifest['shared_prefixes']
            >)
            .prefault({}),
        ignored_paths: z.array(z.string().min(1)).default([]),
        route_files: z.array(z.string().min(1)).default([]),
        generated: z.array(z.string().min(1)).default([]),
        allowed_words: optionalStringList,
        configuration: z.strictObject({
            name: z.string().regex(NAME_PATTERN),
            group: z.enum(GROUPS),
            title: z.string(),
            requires: optionalStringList,
            suggests: optionalStringList,
            always_selected: z.boolean().default(false),
            // init omits a configuration whose checks all read Git when the folder has no .git.
            when: (conditionSchema.pick({ git: true }) satisfies z.ZodType<Pick<ConditionFields, 'git'>>).optional(),
            description: nonemptyString,
        } satisfies SchemaShape<ParsedManifest['configuration']>),
        detect: detectionSchema.optional(),
        files: filesSchema.prefault({}),
        tool: z.array(manifestToolSchema).default([]),
        // Files under semgrep/ become per-scope Semgrep packs when the scope selects security; explicit tool files supply pack-specific metadata.
        tool_file: z.array(toolFileSchema).default([]),
        check: z.array(checkSchema).default([]),
        // The naming rules of the framework or platform, merged after the shipped settings and before the repository's own.
        naming: z
            .strictObject({
                override: z.array(declaredNamingOverrideSchema).default([]),
            } satisfies SchemaShape<NonNullable<ParsedManifest['naming']>>)
            .optional(),
        // Rule files, by name, that install only when their condition holds. Every other file in the rules folder installs
        // with the configuration. Detection reads each condition as it reads a detection table, with the other lists empty.
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
    // A manifest writes one [[tool]], [[tool_file]], or [[check]] record for each item; the code reads them as lists.
    .transform(({ tool, tool_file: toolFiles, check, detect, ...rest }) => ({
        ...rest,
        // An absent detection table inherits only the matcher fields of the validated file declaration.
        detect: detect ?? detectionSchema.strip().parse(rest.files),
        tools: tool,
        toolFiles: toolFiles.map((toolFile) => ({
            ...toolFile,
            target: toolFile.root
                ? toolFile.file
                : posix.join(
                      GSPOT_CONFIGURATIONS_PATH,
                      rest.configuration.group,
                      rest.configuration.name,
                      toolFile.file,
                  ),
        })),
        checks: check.map((entry) => ({ ...entry, name: `${rest.configuration.name}/${entry.name}` })),
    })) satisfies z.ZodType<ParsedManifest>;
