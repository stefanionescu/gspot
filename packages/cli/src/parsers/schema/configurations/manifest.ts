import { z } from 'zod';
import { posix } from 'node:path';
import { outputSchema } from '#cli/parsers/schema/output.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { namingRuleSchema } from '#cli/parsers/schema/naming.ts';
import { fileKindSchema } from '#cli/parsers/schema/inventory.ts';
import { SENTENCE_MIN_CHARS } from '#cli/config/configurations.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/packages.ts';
import { toolSchema } from '#cli/parsers/schema/configurations/tool.ts';
import { commandSchema, checkStageSchema, findingExitCodesSchema } from '#cli/parsers/schema/command.ts';
import { levelSchema, operatingSystemSchema, settingValidationSchema } from '#cli/parsers/schema/settings.ts';

const stringList = z.array(z.string()).default([]);

const filesSchema = z.strictObject({
    extensions: stringList,
    filenames: stringList,
    tags: stringList,
    paths: stringList,
    languages: z.boolean().default(false),
    // The file types the Prettier plugins of the selected configurations format, such as .astro, join the owned ones.
    prettier_plugins: z.boolean().default(false),
    // The file types the ESLint plugins of the selected configurations lint, such as .vue, join the owned ones.
    eslint_plugins: z.boolean().default(false),
    kinds: z.array(fileKindSchema).default(['source']),
});

const pointerSchema = z
    .strictObject({
        path: z.string(),
        directories: z.array(z.string().min(1)).min(1).optional(),
        body: z.string().optional(),
        template: z.string().optional(),
    })
    .refine(
        (pointer) => pointer.template === undefined || pointer.body === undefined,
        'A template pointer cannot also specify a body.',
    )
    .refine(
        (pointer) =>
            pointer.directories === undefined || (pointer.body !== undefined && pointer.template === undefined),
        'Directory pointers require a body without a template.',
    );

// A syntax selector a fragment adds to the one no-restricted-syntax rule: everywhere, in the named files, or everywhere except the paths a setting allows.
const selectorSchema = z.strictObject({
    level: levelSchema,
    selector: z.string().min(1),
    message: z.string().min(1),
    files: z.array(z.string().min(1)).min(1).optional(),
    allowed: z.string().min(1).optional(),
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

const configSchema = z
    .strictObject({
        template: z.string().optional(),
        imports: z.string().optional(),
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
        rule_keys: z.array(z.string()).optional(),
        stub_file: pointerSchema.optional(),
        fragment: z.boolean().default(false),
        scoped: z.boolean().default(false),
        generated_header: z.boolean().default(true),
        when: conditionSchema.pick({ configuration: true }).optional(),
        component_globs: z.array(z.string().min(1)).default([]),
        selectors: z.array(selectorSchema).default([]),
    })
    // A config that is not a fragment reads the template named after its target file, unless it names another.
    .transform((config) =>
        config.fragment
            ? { ...config, fragment: true as const }
            : {
                  ...config,
                  fragment: false as const,
                  template: config.template ?? `${posix.basename(config.target)}.tmpl`,
              },
    );

const sentence = z.string().min(SENTENCE_MIN_CHARS);

const stringListTable = z.record(z.string(), z.array(z.string()));

const checkFields = z.strictObject({
    title: z.string().min(1).optional(),
    // The name inside the configuration; the check's ID is the configuration's name, a slash, and this, as python/ruff.
    name: z.string().regex(/^[a-z0-9-]+$/),
    level: levelSchema,
    stage: checkStageSchema,
    runs: z.enum(['files', 'scope', 'once']).default('files'),
    command: commandSchema.optional(),
    run_in_copy: z.boolean().optional(),
    path_prefix: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    fix: commandSchema.optional(),
    exit_codes: findingExitCodesSchema.optional(),
    replaces: z.string().optional(),
    when: conditionSchema.pick({ configuration: true, setting: true, git: true }).partial().optional(),
    limit: z.string().optional(),
    finding_count_pattern: z.string().optional(),
    crash_pattern: z.string().optional(),
    needs: z
        .array(z.enum(['build', 'docker', 'network']))
        .min(1)
        .optional(),
    platforms: z.array(operatingSystemSchema).optional(),
    tool: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
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
    alternatives_checked: z.array(z.string()).optional(),
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

// A path-scoped naming rule a configuration ships, in the shape gspot.toml writes under [[naming.paths]].
const manifestNamingRule = namingRuleSchema.extend({ reason: z.string().min(1) });

const settingSchema = z.strictObject({
    validation: settingValidationSchema.prefault({}),
    name: z.string(),
    type: z.enum(['number', 'string', 'boolean', 'list', 'table']),
    direction: z.enum(['ceiling', 'floor', 'loosening', 'tightening', 'neutral', 'rule-options']),
    // Native disabled-rule values representable in TOML; absent for settings that do not enable rules.
    off_values: z
        .array(z.union([z.string(), z.number(), z.boolean()]))
        .min(1)
        .optional(),
    default: z.unknown().optional(),
    default_all: z.unknown().optional(),
    // An entry whose reason equals this identity field already explains the intended spelling.
    reason_identity: z.string().min(1).optional(),
    summary: sentence,
    languages: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
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

const detectionSchema = z
    .strictObject({
        extensions: stringList,
        filenames: stringList,
        dependencies: stringList,
        shebangs: stringList,
        runtimes: z.array(z.enum(JAVASCRIPT_RUNTIMES)).default([]),
        tags: stringList,
        paths: stringList,
        // A file, or a folder such as *.xcodeproj, whose folder is a project: init proposes a scope there.
        project_files: stringList,
    })
    .prefault({});

// The shape of a configuration manifest.toml after validation.
export const manifestSchema = z
    .strictObject({
        ignored: z.array(z.string().refine(isIgnoredPath, 'Ignored paths must stay inside .gspot.')).default([]),
        configuration: z.strictObject({
            name: z.string().regex(/^[a-z0-9-]+$/),
            kind: z.enum(['language', 'framework', 'platform', 'tool', 'library', 'database', 'general']),
            title: z.string(),
            requires: stringList,
            borrowed_checks: z.array(z.string().min(1)).default([]),
            recommends: stringList,
            always_selected: z.boolean().default(false),
            // A configuration whose checks all read git is not proposed in a folder with no .git.
            when: conditionSchema.pick({ git: true }).optional(),
            description: sentence,
        }),
        detect: detectionSchema,
        files: filesSchema.prefault({}),
        tool: z.array(toolSchema).default([]),
        config: z.array(configSchema).default([]),
        check: z.array(checkSchema).default([]),
        setting: z.array(settingSchema).default([]),
        // Defaults this configuration sets for settings another configuration declares, by setting name; `set_all` applies at level all.
        set: z.record(z.string().min(1), z.unknown()).default({}),
        set_all: z.record(z.string().min(1), z.unknown()).default({}),
        // The naming rules of the framework or platform, merged after the shipped policy and before the repository's own.
        naming: z.strictObject({ paths: z.array(manifestNamingRule).default([]) }).optional(),
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
    // A manifest writes one [[tool]], [[config]], [[check]], or [[setting]] table per entry; the code reads the lists.
    .transform(({ tool, config, check, setting, ...rest }) => ({
        ...rest,
        tools: tool,
        configs: config,
        checks: check,
        settings: setting,
    }));
