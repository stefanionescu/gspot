import { z } from 'zod';
import { posix } from 'node:path';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { fileKindSchema } from '#cli/parsers/schema/inventory.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/packages.ts';
import { pathContainerSchema, namingOverrideSchema } from '#cli/parsers/schema/naming.ts';
import { SENTENCE_MIN_CHARS, TEST_FILES_PLACEHOLDER } from '#cli/config/configurations.ts';
import { commandSchema, checkStageSchema, findingExitCodesSchema } from '#cli/parsers/schema/command.ts';

import {
    eslintPresetSchema,
    versionFloorSchema,
    eslintAllRulesSchema,
    toolDeclarationSchema,
} from '#cli/parsers/schema/public.ts';
import {
    levelSchema,
    outputSchema,
    operatingSystemSchema,
    settingValidationSchema,
    settingValueDeclarationSchema,
} from '#cli/parsers/schema/contracts.ts';

const stringList = z.array(z.string()).default([]);

const filesSchema = z.strictObject({
    extensions: stringList,
    filenames: stringList,
    tags: stringList,
    paths: z
        .array(
            z
                .string()
                .refine(
                    (path) => !path.includes('{setting:') || path === TEST_FILES_PLACEHOLDER,
                    'A file path setting reference must be the whole {setting:test_files} token.',
                ),
        )
        .default([]),
    languages: z.boolean().default(false),
    // The file types the Prettier plugins of the selected configurations format, such as .astro, join the owned ones.
    prettier_plugins: z.boolean().default(false),
    // The file types the ESLint plugins of the selected configurations lint, such as .vue, join the owned ones.
    eslint_plugins: z.boolean().default(false),
    kinds: z.array(fileKindSchema).default(['source']),
});

// The one way a manifest limits where something applies. It names a selected configuration, a setting with a value, detected
// files, tags, or dependencies, or a git checkout. `git = false` means a folder with no .git. Each table takes the
// conditions it can test.
const conditionSchema = z.strictObject({
    configuration: z.string().min(1),
    setting: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean()]),
    git: z.boolean(),
    dependencies: z.array(z.string().min(1)).min(1),
    filenames: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string().min(1)).min(1),
    runtimes: z.array(z.enum(JAVASCRIPT_RUNTIMES)).min(1),
});

// An all-level syntax selector a fragment adds to the one no-restricted-syntax rule: everywhere, in the named files, or everywhere except the paths a setting allows.
const selectorSchema = z.strictObject({
    selector: z.string().min(1),
    message: z.string().min(1),
    files: z.array(z.string().min(1)).min(1).optional(),
    role: z.string().min(1).optional(),
    allowed: z.string().min(1).optional(),
    ignores: z.array(z.string().min(1)).min(1).optional(),
    when: conditionSchema.pick({ setting: true, value: true }).optional(),
});

const pointerSchema = z
    .strictObject({
        path: z.string(),
        when: conditionSchema.pick({ configuration: true }).optional(),
        directories: z.array(z.string().min(1)).min(1).optional(),
        body: z.string().optional(),
        template: z.string().optional(),
    })
    .refine(
        (pointer) => pointer.template === undefined || pointer.body === undefined,
        'A template pointer cannot also specify a body.',
    )
    .refine(
        (pointer) => pointer.directories === undefined || pointer.body !== undefined || pointer.template !== undefined,
        'Directory pointers require a body or a template.',
    );

const toolFileSchema = z
    .strictObject({
        source: z.string().optional(),
        target: z.string(),
        // Emit the target when an applicable check in its scope consumes any named tool.
        tool: z
            .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
            .transform((tool) => (typeof tool === 'string' ? [tool] : tool))
            .default([]),
        check: z
            .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
            .transform((check) => (typeof check === 'string' ? [check] : check))
            .default([]),
        // Companion tools needed only when an applicable check consumes this configuration.
        required_tools: z.array(z.string().min(1)).default([]),
        rule_keys: z.array(z.string()).optional(),
        pointer: pointerSchema.optional(),
        fragment: z.boolean().default(false),
        scope_fragments: z.boolean().default(false),
        per_scope: z.boolean().default(false),
        generated_header: z.boolean().default(true),
        when: conditionSchema.pick({ configuration: true }).optional(),
        selectors: z.array(selectorSchema).default([]),
    })
    .refine(
        (toolFile) => toolFile.required_tools.length === 0 || toolFile.tool.length > 0 || toolFile.check.length > 0,
        'Companion tools require a consuming tool or check.',
    )
    // A tool file that is not a fragment reads the source named after its target file, unless it names another.
    .transform((toolFile) =>
        toolFile.fragment
            ? { ...toolFile, fragment: true as const }
            : {
                  ...toolFile,
                  fragment: false as const,
                  source: toolFile.source ?? `${posix.basename(toolFile.target)}.eta`,
              },
    );

const sentence = z.string().min(SENTENCE_MIN_CHARS);

const stringListTable = z.record(z.string(), z.array(z.string()));

const checkFields = z.strictObject({
    title: z.string().min(1),
    // The name inside the configuration; the check's ID is the configuration's name, a slash, and this, as python/ruff.
    name: z.string().regex(/^[a-z0-9-]+$/),
    level: levelSchema,
    stage: checkStageSchema,
    runs: z.enum(['files', 'scope', 'once', 'history']).default('files'),
    command: commandSchema.optional(),
    generated_paths: z
        .array(
            z.union([
                z.strictObject({ path: z.string() }).transform(({ path }) => ({ kind: 'path' as const, path })),
                z
                    .strictObject({ pattern: z.string().min(1) })
                    .transform(({ pattern }) => ({ kind: 'pattern' as const, path: pattern })),
                z
                    .strictObject({ stdout: z.string() })
                    .transform(({ stdout }) => ({ kind: 'stdout' as const, path: stdout })),
            ]),
        )
        .min(1)
        .optional(),
    run_in_copy: z.boolean().optional(),
    path_prefix: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    fix: commandSchema.optional(),
    exit_codes: findingExitCodesSchema.optional(),
    replaces: z.string().optional(),
    when: conditionSchema
        .pick({ configuration: true, setting: true, git: true, dependencies: true })
        .partial()
        .optional(),
    limit: z.string().optional(),
    finding_count_pattern: z.string().optional(),
    crash_pattern: z.string().optional(),
    needs: z
        .array(z.enum(['build', 'docker', 'network']))
        .min(1)
        .optional(),
    platforms: z.array(operatingSystemSchema).optional(),
    tool: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
    min_versions: z.record(z.string().min(1), versionFloorSchema).optional(),
    files: filesSchema.optional(),
    output: outputSchema.optional(),
    cwd: z.enum(['root', 'scope']).optional(),
    ignore_file: z
        .string()
        .min(1)
        .optional()
        .meta({ description: 'A repository-relative file containing ordered gitignore patterns for this check.' }),
    nested_config_file: z
        .string()
        .regex(/^[A-Za-z0-9_.-]+$/u)
        .optional(),
    summary: sentence,
    example: z.string().trim().min(1),
    why: sentence,
    help: sentence,
});

// A check runs its command, or gspot runs it itself when the check registry names its ID. A list of tools names the
// tool the check runs, then the tools its command starts, such as the bash that runs Bats; each must be usable.
const checkSchema = checkFields.transform(({ tool, ...check }) => {
    const [first, ...others] = typeof tool === 'string' ? [tool] : (tool ?? []);
    return {
        ...check,
        ...(first === undefined ? {} : { tool: first }),
        ...(others.length === 0 ? {} : { other_tools: others }),
    };
});

// A path-scoped naming rule a configuration ships, in the shape gspot.toml writes under [[naming.overrides]].
const manifestNamingOverride = namingOverrideSchema.extend({ reason: z.string().min(1) });

const settingSchema = settingValueDeclarationSchema
    .extend({
        name: z.string(),
        direction: z.enum(['ceiling', 'floor', 'loosening', 'tightening', 'neutral', 'rule-options']),
        // Native disabled-rule values representable in TOML; absent for settings that do not enable rules.
        off_values: z
            .array(z.union([z.string(), z.number(), z.boolean()]))
            .min(1)
            .optional(),
        // An entry whose reason equals this identity field already explains the intended spelling.
        reason_identity: z.string().min(1).optional(),
        summary: sentence,
        languages: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
    })
    .superRefine((setting, context) => {
        if (setting.items !== undefined && setting.type !== 'list')
            context.addIssue({ code: 'custom', path: ['items'], message: 'Only a list setting declares items.' });
    });

// An ignored path: .gspot, then one or more names, and at most a trailing slash; no . or .. segment.
function isIgnoredPath(path: string): boolean {
    const [root, ...names] = (path.endsWith('/') ? path.slice(0, -1) : path).split('/');
    return (
        root === DOT_GSPOT &&
        names.length > 0 &&
        names.every((name) => /^[A-Za-z0-9._-]+$/u.test(name) && name !== '.' && name !== '..')
    );
}

const detectionSchema = z.strictObject({
    content: z.record(z.string().min(1), settingValidationSchema.shape.pattern.unwrap()).default({}),
    extensions: stringList,
    filenames: stringList,
    dependencies: stringList,
    shebangs: stringList,
    runtimes: z.array(z.enum(JAVASCRIPT_RUNTIMES)).default([]),
    tags: stringList,
    paths: stringList,
    // A file, or a folder such as *.xcodeproj, whose folder is a project: init proposes a scope there.
    project_files: stringList,
});

// The shape of a configuration manifest.toml after validation.
export const manifestSchema = z
    .strictObject({
        eslint_presets: z
            .record(z.string().min(1), eslintPresetSchema.pick({ package: true, source: true }))
            .default({}),
        eslint_all_rules: eslintAllRulesSchema.prefault([]),
        compiler_options: z.record(z.string().min(1), z.boolean()).default({}),
        ignored_folders: z.array(z.string().min(1)).default([]),
        dockerignore: z.array(z.string().min(1)).default([]),
        generated: z.array(z.string().min(1)).default([]),
        ignored: z.array(z.string().refine(isIgnoredPath, 'Ignored paths must stay inside .gspot.')).default([]),
        configuration: z.strictObject({
            name: z.string().regex(/^[a-z0-9-]+$/),
            kind: z.enum(['language', 'framework', 'platform', 'tool', 'library', 'database', 'general']),
            title: z.string(),
            requires: stringList,
            suggests: stringList,
            always_selected: z.boolean().default(false),
            // A configuration whose checks all read git is not proposed in a folder with no .git.
            when: conditionSchema.pick({ git: true }).optional(),
            description: sentence,
            notes: z.string().optional(),
        }),
        detect: detectionSchema.optional(),
        files: filesSchema.prefault({}),
        tool: z.array(toolDeclarationSchema).default([]),
        tool_file: z.array(toolFileSchema).default([]),
        check: z.array(checkSchema).default([]),
        setting: z.array(settingSchema).default([]),
        // Defaults this configuration sets for settings another configuration declares, by setting name; `set_all` applies at level all.
        set: z.record(z.string().min(1), z.unknown()).default({}),
        set_all: z.record(z.string().min(1), z.unknown()).default({}),
        // The naming rules of the framework or platform, merged after the shipped policy and before the repository's own.
        naming: z
            .strictObject({
                overrides: z.array(manifestNamingOverride).default([]),
                path_containers: z.array(pathContainerSchema).default([]),
            })
            .optional(),
        // Files a dead-code scan starts from, relative to the scope, for the code this configuration knows.
        entry: stringList,
        // The files of the configuration's rules folder that install only when their condition holds, by file name. Every other
        // file there installs with the configuration. The detection reads a condition as it reads a configuration's, the other lists empty.
        agent_rules: z
            .record(
                z.string().regex(/^[A-Z0-9-]+\.md$/u),
                conditionSchema
                    .pick({ dependencies: true, filenames: true, tags: true, runtimes: true })
                    .partial()
                    .transform((condition) => detectionSchema.parse(condition)),
            )
            .default({}),
        ruff_rules: z.strictObject({ recommended: stringList, all: stringList }).prefault({}),
        required_eslint_rules: stringListTable.default({}),
        eslint_rules_off: z
            .array(
                z.strictObject({
                    rules: z.array(z.string().min(1)).min(1),
                    reason: sentence,
                    files: z.array(z.string().min(1)).min(1).optional(),
                    when: conditionSchema.pick({ setting: true, value: true }).optional(),
                }),
            )
            .default([]),
    })
    // A manifest writes one [[tool]], [[tool_file]], [[check]], or [[setting]] table per entry; the code reads the lists.
    .transform(({ tool, tool_file: toolFiles, check, setting, detect, ...rest }) => ({
        ...rest,
        // An absent detection table inherits only the native matcher fields of the validated file declaration.
        detect: detect ?? detectionSchema.strip().parse(rest.files),
        tools: tool,
        toolFiles,
        checks: check,
        settings: setting,
    }));
