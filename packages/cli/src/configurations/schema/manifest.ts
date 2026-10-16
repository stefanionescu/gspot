import { z } from 'zod';
import { posix } from 'node:path';
import { RULE_FILE_PATTERN } from '#cli/config/rules.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { TOOL_FILE_PREFIX } from '#cli/config/system/locations.ts';
import type { EslintPresets } from '#cli/types/generation/eslint.ts';
import { toolDeclarationSchema } from '#cli/configurations/schema/tool.ts';
import { namingOverrideSchema } from '#cli/configurations/schema/naming.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependency-files.ts';

import {
    GROUPS,
    CHECK_RUNS,
    CHECK_NEEDS,
    NAME_PATTERN,
    TOOL_FILES_FOLDER,
    CHECK_WORKING_DIRECTORIES,
} from '#cli/config/configurations.ts';
import {
    levelSchema,
    regexSchema,
    fileKindSchema,
    conditionSchema,
    commandCheckFields,
    operatingSystemSchema,
} from '#cli/configurations/schema/parts.ts';
import type {
    CheckInput,
    ParsedCheck,
    GeneratedPath,
    ManifestInput,
    ToolFileInput,
    EslintAllRules,
    ParsedManifest,
    FileMatchInput,
    DetectionInput,
    ConditionFields,
    ToolFileDeclaration,
} from '#cli/types/configurations.ts';

const optionalStringList = z.array(z.string()).default([]);

const filesSchema = z.strictObject({
    extensions: optionalStringList,
    filenames: optionalStringList,
    tags: optionalStringList,
    paths: optionalStringList,
    languages: z.boolean().default(false),
    // The file types the Prettier plugins of the selected configurations format, such as .astro, join the owned ones.
    prettier_plugins: z.boolean().default(false),
    // The file types the ESLint plugins of the selected configurations lint, such as .vue, join the owned ones.
    eslint_plugins: z.boolean().default(false),
    kinds: z.array(fileKindSchema).default(['source']),
} satisfies SchemaShape<ParsedManifest['files'], FileMatchInput>);

// A syntax selector applies to every source file or to an architecture role.
const selectorSchema = z.strictObject({
    selector: z.string().min(1),
    message: z.string().min(1),
    role: z.string().min(1).optional(),
} satisfies SchemaShape<ParsedManifest['eslint']['selectors'][number]>);

const pointerSchema = z.strictObject({
    path: z.string(),
    when: conditionSchema.pick({ configuration: true }).optional(),
    directories: z.array(z.string().min(1)).min(1).optional(),
    body: z.string().optional(),
} satisfies SchemaShape<NonNullable<ToolFileDeclaration['pointer']>>);

// A tool-file consumer accepts one declared name or a nonempty list of names.
const consumerNamesSchema = z
    .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
    .transform((names) => (typeof names === 'string' ? [names] : names))
    .default([]) satisfies z.ZodType<string[], string | string[] | undefined>;

const toolFileSchema = z
    .strictObject({
        level: levelSchema.optional(),
        target: z.string(),
        // Emit the target when an applicable check in its scope consumes any named tool.
        tool: consumerNamesSchema,
        check: consumerNamesSchema,
        // Companion tools needed only when an applicable check consumes this configuration.
        required_tools: z.array(z.string().min(1)).default([]),
        pointer: pointerSchema.optional(),
        fragment: z.boolean().default(false),
        per_scope: z.boolean().default(false),
        when: conditionSchema.pick({ configuration: true }).optional(),
    } satisfies SchemaShape<Omit<ToolFileDeclaration, 'source' | 'fragment'> & { fragment: boolean }, ToolFileInput>)
    .refine(
        (toolFile) => toolFile.required_tools.length === 0 || toolFile.tool.length > 0 || toolFile.check.length > 0,
        'Companion tools require a consuming tool or check.',
    )
    // Copied files use the same relative path beneath tool-files and the generated configuration folder.
    .transform((toolFile) =>
        toolFile.fragment
            ? { ...toolFile, fragment: true as const }
            : {
                  ...toolFile,
                  fragment: false as const,
                  source: posix.join(
                      TOOL_FILES_FOLDER,
                      toolFile.target.startsWith(TOOL_FILE_PREFIX)
                          ? toolFile.target.slice(TOOL_FILE_PREFIX.length)
                          : posix.basename(toolFile.target),
                  ),
              },
    ) satisfies z.ZodType<ToolFileDeclaration, ToolFileInput>;

const sentence = z.string().min(1);

const checkFields = z.strictObject({
    ...commandCheckFields,
    // The name inside the configuration; the check's ID joins the configuration name, a slash, and this name, as python/ruff.
    name: z.string().regex(NAME_PATTERN),
    level: levelSchema,
    runs: z.enum(CHECK_RUNS).default('files'),
    generator_outputs: z
        .array(
            z.union([
                z
                    .strictObject({ path: z.string() } satisfies SchemaShape<{ path: string }>)
                    .transform(({ path }) => ({ kind: 'path' as const, path })) satisfies z.ZodType<
                    GeneratedPath,
                    Extract<NonNullable<CheckInput['generator_outputs']>[number], { path: string }>
                >,
                z
                    .strictObject({ pattern: z.string().min(1) } satisfies SchemaShape<{ pattern: string }>)
                    .transform(({ pattern }) => ({ kind: 'pattern' as const, path: pattern })) satisfies z.ZodType<
                    GeneratedPath,
                    Extract<NonNullable<CheckInput['generator_outputs']>[number], { pattern: string }>
                >,
                z
                    .strictObject({ stdout: z.string() } satisfies SchemaShape<{ stdout: string }>)
                    .transform(({ stdout }) => ({ kind: 'stdout' as const, path: stdout })) satisfies z.ZodType<
                    GeneratedPath,
                    Extract<NonNullable<CheckInput['generator_outputs']>[number], { stdout: string }>
                >,
            ]),
        )
        .min(1)
        .optional(),
    run_in_copy: z.boolean().optional(),
    env: z.record(z.string(), z.string()).optional(),
    instead_of: z.string().optional(),
    when: (
        conditionSchema.pick({ configuration: true, setting: true, git: true, dependencies: true }) satisfies z.ZodType<
            Pick<ConditionFields, 'configuration' | 'setting' | 'git' | 'dependencies'>
        >
    )
        .partial()
        .optional(),
    crash_pattern: regexSchema.optional(),
    needs: z.array(z.enum(CHECK_NEEDS)).min(1).optional(),
    operating_systems: z.array(operatingSystemSchema).optional(),
    tool: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
    files: filesSchema.optional(),
    cwd: z.enum(CHECK_WORKING_DIRECTORIES).optional(),
    summary: sentence,
    example: z.string().trim().min(1),
    why: sentence,
    help: sentence,
} satisfies SchemaShape<
    Omit<ParsedCheck, 'tool' | 'other_tools'> & { tool?: string | string[] | undefined },
    CheckInput
>);

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
}) satisfies z.ZodType<ParsedCheck, CheckInput>;

// A path-scoped naming rule a configuration ships, in the shape gspot.toml writes under [[naming.override]].
const manifestNamingOverride = namingOverrideSchema.extend({ reason: z.string().min(1) } satisfies SchemaShape<{
    reason: string;
}>);

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
} satisfies SchemaShape<ParsedManifest['detect'], DetectionInput>);

const eslintAllRulesSchema = z
    .array(z.string().min(1))
    .transform((rules) => new Set(rules)) satisfies z.ZodType<EslintAllRules>;

/** JSON fields that a preset contributes to rule applicability and settings. */
const eslintPresetBlockSchema = z.strictObject({
    files: z.array(z.union([z.string(), z.array(z.string())])).optional(),
    ignores: z.array(z.string()).optional(),
    basePath: z.string().optional(),
    parser: z.boolean(),
    rules: z.record(z.string(), z.json()).optional(),
} satisfies SchemaShape<EslintPresets[string]['blocks'][number]>);

/** A copy identifies its exact installed package and public preset export. */
export const eslintPresetSchema = z.strictObject({
    package: z.string(),
    version: z.string(),
    source: z.string(),
    blocks: z.array(eslintPresetBlockSchema),
} satisfies SchemaShape<EslintPresets[string]>);

// The shape of a configuration manifest.toml after validation.
export const manifestSchema = z
    .strictObject({
        defaults: z.record(z.string().min(1), z.json()).default({}),
        eslint: z
            .strictObject({
                presets: z
                    .record(
                        z.string().min(1),
                        eslintPresetSchema.pick({ package: true, source: true }) satisfies z.ZodType<
                            Pick<EslintPresets[string], 'package' | 'source'>
                        >,
                    )
                    .default({}),
                all_level_rules: eslintAllRulesSchema.prefault([]),
                selectors: z.array(selectorSchema).default([]),
                rules_off: z
                    .array(
                        z.strictObject({
                            rules: z.array(z.string().min(1)).min(1),
                            reason: sentence,
                            files: z.array(z.string().min(1)).min(1).optional(),
                        } satisfies SchemaShape<ParsedManifest['eslint']['rules_off'][number]>),
                    )
                    .default([]),
            } satisfies SchemaShape<ParsedManifest['eslint'], NonNullable<ManifestInput['eslint']>>)
            .prefault({}),
        shared_prefixes: z
            .strictObject({ prefixes: optionalStringList, kinds: optionalStringList } satisfies SchemaShape<
                ParsedManifest['shared_prefixes'],
                NonNullable<ManifestInput['shared_prefixes']>
            >)
            .prefault({}),
        ignored_folders: z.array(z.string().min(1)).default([]),
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
            description: sentence,
        } satisfies SchemaShape<ParsedManifest['configuration'], ManifestInput['configuration']>),
        detect: detectionSchema.optional(),
        files: filesSchema.prefault({}),
        tool: z.array(toolDeclarationSchema).default([]),
        // Files under semgrep/ become per-scope Semgrep packs when the scope selects security; explicit tool files supply pack-specific metadata.
        tool_file: z.array(toolFileSchema).default([]),
        check: z.array(checkSchema).default([]),
        // The naming rules of the framework or platform, merged after the shipped settings and before the repository's own.
        naming: z
            .strictObject({
                override: z.array(manifestNamingOverride).default([]),
            } satisfies SchemaShape<NonNullable<ParsedManifest['naming']>, NonNullable<ManifestInput['naming']>>)
            .optional(),
        // The files of the configuration's rules folder that install only when their condition holds, by file name. Every other
        // file there installs with the configuration. The detection reads a condition as it reads a configuration's, the other lists empty.
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
                ParsedManifest['ruff'],
                NonNullable<ManifestInput['ruff']>
            >)
            .prefault({}),
    } satisfies SchemaShape<
        Omit<ParsedManifest, 'detect' | 'tools' | 'toolFiles' | 'checks'> & {
            detect?: ParsedManifest['detect'] | undefined;
            tool: ParsedManifest['tools'];
            check: ParsedCheck[];
        } & Record<'tool_file', ToolFileDeclaration[]>,
        ManifestInput
    >)
    // A manifest writes one [[tool]], [[tool_file]], or [[check]] table per entry; the code reads the lists.
    .transform(({ tool, tool_file: toolFiles, check, detect, ...rest }) => ({
        ...rest,
        // An absent detection table inherits only the matcher fields of the validated file declaration.
        detect: detect ?? detectionSchema.strip().parse(rest.files),
        tools: tool,
        toolFiles,
        checks: check,
    })) satisfies z.ZodType<ParsedManifest, ManifestInput>;
