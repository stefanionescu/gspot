import { z } from 'zod';
import { toolSchema } from '#cli/kits/tools.ts';
import { SENTENCE_MIN } from '#cli/config/kits.ts';
import { outputSchema } from '#cli/kits/output.ts';
import { GSPOT_FOLDER } from '#cli/config/repository/repository.ts';
import { commandSchema, findingExitCodesSchema } from '#cli/kits/command.ts';

const stringList = z.array(z.string()).default([]);

const ownersSchema = z.strictObject({
    extensions: stringList,
    filenames: stringList,
    tags: stringList,
    paths: stringList,
    languages: z.boolean().default(false),
    // The file types the Prettier plugins of the selected kits format, such as .astro, join the owned ones.
    prettier_plugins: z.boolean().default(false),
    kinds: z.array(z.enum(['source', 'generated', 'vendored', 'binary'])).default(['source']),
});

const pointerSchema = z
    .strictObject({
        path: z.string(),
        directories: z.array(z.string().min(1)).min(1).optional(),
        body: z.string().optional(),
        merge: z.record(z.string(), z.unknown()).optional(),
        copy: z.boolean().optional(),
        template: z.string().optional(),
    })
    .refine(
        (pointer) =>
            pointer.template === undefined ||
            (pointer.body === undefined && pointer.merge === undefined && pointer.copy === undefined),
        'A template pointer cannot also specify body, merge, or copy.',
    )
    .refine(
        (pointer) =>
            pointer.directories === undefined ||
            (pointer.body !== undefined &&
                pointer.merge === undefined &&
                pointer.copy === undefined &&
                pointer.template === undefined),
        'Directory pointers require a body without merge, copy, or template.',
    );

// A syntax selector a fragment adds to the one no-restricted-syntax rule: everywhere, in the named files, or everywhere except the paths a setting allows.
const selectorSchema = z.strictObject({
    level: z.enum(['recommended', 'all']),
    selector: z.string().min(1),
    message: z.string().min(1),
    files: z.array(z.string().min(1)).min(1).optional(),
    allowed: z.string().min(1).optional(),
});

const configSchema = z
    .strictObject({
        template: z.string().optional(),
        imports: z.string().optional(),
        target: z.string(),
        rules_path: z.array(z.string()).optional(),
        pointer: pointerSchema.optional(),
        fragment: z.boolean().default(false),
        scoped: z.boolean().default(false),
        header: z.boolean().default(true),
        needs: z.string().optional(),
        components: z.array(z.string().min(1)).default([]),
        selectors: z.array(selectorSchema).default([]),
    })
    .refine(
        (config) => config.fragment || config.template !== undefined,
        'A config that is not a fragment names its template.',
    );

const sentence = z.string().min(SENTENCE_MIN);

const stringListTable = z.record(z.string(), z.array(z.string()));

const checkFields = z.strictObject({
    title: z.string().min(1).optional(),
    name: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
    level: z.enum(['recommended', 'all']),
    stage: z.enum(['commit', 'push', 'manual', 'message']),
    runs: z.enum(['files', 'scope', 'once']).default('files'),
    command: commandSchema.optional(),
    isolated_files: z.boolean().optional(),
    file_prefix: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    fix: commandSchema.optional(),
    exit_codes: findingExitCodesSchema.optional(),
    replaces: z.string().optional(),
    needs: z.string().optional(),
    limit: z.string().optional(),
    count_pattern: z.string().optional(),
    crash_pattern: z.string().optional(),
    // true: the check reads git and is skipped in a folder with no .git; false: it stands in for one and runs only there.
    needs_git: z.boolean().optional(),
    requires: z.enum(['build', 'docker', 'network']).optional(),
    // Tools the command starts through another name, such as the bash that runs Bats; each must be usable too.
    requires_tools: z.array(z.string().min(1)).optional(),
    waits_for: z.string().optional(),
    platforms: z.array(z.enum(['macos', 'linux', 'windows'])).optional(),
    tool: z.string().optional(),
    owners: ownersSchema.optional(),
    output: outputSchema.optional(),
    cwd: z.enum(['root', 'scope']).optional(),
    nested_config: z
        .string()
        .regex(/^[A-Za-z0-9_.-]+$/u)
        .optional(),
    exclude_setting: z.string().optional(),
    summary: sentence,
    example: z.string().trim().min(1),
    why: sentence,
    help: sentence,
    searched: z.array(z.string()).optional(),
});

// A check runs its command, or gspot runs it itself when the check registry names its ID.
const checkSchema = checkFields.extend({ command: commandSchema.optional() });

// A path-scoped naming rule a kit ships, in the shape gspot.toml writes under [[naming.rules]].
const manifestNamingRule = z.strictObject({
    paths: z.array(z.string().min(1)).min(1),
    languages: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    names: z.array(z.string()).optional(),
    structural_prefix: z.string().optional(),
    allow_digits: z.boolean().optional(),
    allow_duplicate_words: z.boolean().optional(),
    exclude: z.boolean().optional(),
    case: z.array(z.string()).optional(),
    reason: z.string().min(1),
});

const settingSchema = z.strictObject({
    name: z.string(),
    type: z.enum(['number', 'string', 'boolean', 'list', 'table']),
    direction: z.enum(['ceiling', 'floor', 'loosening', 'tightening', 'neutral', 'per-rule']),
    default: z.unknown().optional(),
    default_all: z.unknown().optional(),
    summary: sentence,
    languages: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
});

// The shape of a kit manifest.toml after validation.

// An untracked path: .gspot, then one or more names, and at most a trailing slash; no . or .. segment.
function isUntrackedPath(path: string): boolean {
    const [root, ...names] = (path.endsWith('/') ? path.slice(0, -1) : path).split('/');
    return (
        root === GSPOT_FOLDER &&
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
        tags: stringList,
        paths: stringList,
        // A file, or a folder such as *.xcodeproj, whose folder is a project: init proposes a scope there.
        project_files: stringList,
    })
    .default({
        extensions: [],
        filenames: [],
        dependencies: [],
        shebangs: [],
        tags: [],
        paths: [],
        project_files: [],
    });

export const manifestSchema = z.strictObject({
    untracked: z.array(z.string().refine(isUntrackedPath, 'Untracked paths must stay inside .gspot.')).default([]),
    kit: z.strictObject({
        name: z.string().regex(/^[a-z0-9-]+$/),
        kind: z.enum(['language', 'framework', 'platform', 'tool', 'library', 'database', 'general']),
        title: z.string(),
        requires: stringList,
        check_references: z.array(z.string().min(1)).default([]),
        recommends: stringList,
        default: z.boolean().default(false),
        proposed: z.boolean().default(false),
        // A configuration whose checks all read git is not proposed in a folder with no .git.
        needs_git: z.boolean().default(false),
        description: sentence,
    }),
    detect: detectionSchema,
    owners: ownersSchema.default({
        extensions: [],
        filenames: [],
        tags: [],
        paths: [],
        languages: false,
        prettier_plugins: false,
        kinds: ['source'],
    }),
    tools: z.array(toolSchema).default([]),
    configs: z.array(configSchema).default([]),
    checks: z.array(checkSchema).default([]),
    settings: z.array(settingSchema).default([]),
    // Defaults this kit sets for settings another kit declares, by setting name; `defaults_all` applies at level all.
    defaults: z.record(z.string().min(1), z.unknown()).default({}),
    defaults_all: z.record(z.string().min(1), z.unknown()).default({}),
    // The naming rules of the framework or platform, merged after the shipped policy and before the repository's own.
    naming: z.strictObject({ rules: z.array(manifestNamingRule).default([]) }).optional(),
    // Files a dead-code scan starts from, relative to the scope, for the code this configuration knows.
    entry: stringList,
    guides: z
        .record(
            z.string(),
            z.array(
                z.strictObject({
                    path: z.string().min(1),
                    when: detectionSchema.unwrap().optional(),
                }),
            ),
        )
        .default({}),
    required_rules: stringListTable.default({}),
    rules_off: z
        .array(
            z.strictObject({
                tool: z.literal('eslint'),
                rules: z.array(z.string().min(1)).min(1),
                reason: sentence,
                files: z.array(z.string().min(1)).min(1).optional(),
                when: z
                    .strictObject({ setting: z.string().min(1), value: z.union([z.string(), z.number(), z.boolean()]) })
                    .optional(),
            }),
        )
        .default([]),
});
