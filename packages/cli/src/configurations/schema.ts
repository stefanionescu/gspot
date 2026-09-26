import { z } from 'zod';
import type { Defined } from '#cli/policy/schema.ts';
import { outputSchema } from '#cli/configurations/output-format.ts';
import { commandSchema, findingExitCodesSchema } from '#cli/configurations/command-schema.ts';

const stringList = z.array(z.string()).default([]);

const claimsSchema = z.strictObject({
    extensions: stringList,
    filenames: stringList,
    tags: stringList,
    paths: stringList,
    from_languages: z.boolean().default(false),
    natures: z.array(z.enum(['source', 'generated', 'vendored', 'binary'])).default(['source']),
});

const MAX_EXIT_CODE = 255;
const installerDefinition = z.strictObject({ name: z.string(), version: z.string() });
const installerSchema = z.union([z.string(), installerDefinition]);
const npmInstallerSchema = z.union([
    z.string(),
    installerDefinition.extend({ version_exit_code: z.number().int().min(0).max(MAX_EXIT_CODE).optional() }),
]);

const installerFields = {
    npm: npmInstallerSchema.optional(),
    pypi: installerSchema.optional(),
    mise: installerSchema.optional(),
    brew: installerSchema.optional(),
    apt: installerSchema.optional(),
    cargo: installerSchema.optional(),
    github: installerSchema.optional(),
    winget: installerSchema.optional(),
    scoop: installerSchema.optional(),
};

const suppressionPattern = z
    .string()
    .min(1)
    .refine((value) => {
        try {
            new RegExp(value, 'u');
            return true;
        } catch {
            return false;
        }
    }, 'Expected a valid Unicode regular expression.');

const toolSchema = z.strictObject({
    name: z.string(),
    kind: z.enum(['binary', 'library']).default('binary'),
    version: z.string().optional(),
    floor: z.string().optional(),
    provider: z.literal('host').optional(),
    windows: z.boolean().default(true),
    version_command: commandSchema.optional(),
    version_exit_code: z.number().int().min(0).max(MAX_EXIT_CODE).optional(),
    version_regex: z.string().optional(),
    // Output that means the tool fell over rather than found something, for every check that runs it.
    crash_pattern: suppressionPattern.optional(),
    // Where the tool documents one rule; explain prints it with the rule name in place of {rule}.
    rule_page: z.string().includes('{rule}', { message: 'A rule page names where {rule} goes.' }).optional(),
    suppression: z
        .strictObject({
            marker: suppressionPattern,
            reason: suppressionPattern,
            forbidden: z.boolean().optional(),
        })
        .optional(),
    env: z.record(z.string(), z.string()).optional(),
    query_packs: z.record(z.string().regex(/^[a-z][a-z0-9-]*$/u), z.string().regex(/^\d+\.\d+\.\d+$/u)).optional(),
    prettier: z
        .strictObject({
            entry: z.string().min(1),
            overrides: z
                .array(z.strictObject({ files: z.string().min(1), options: z.record(z.string(), z.unknown()) }))
                .default([]),
        })
        .optional(),
    takeover: z
        .array(
            z
                .strictObject({
                    file: z.string().min(1),
                    table: z.string().min(1).optional(),
                    key: z.string().min(1).optional(),
                    shared: z.boolean().default(false),
                    check: z.string().min(1).optional(),
                    carries: z.enum([
                        'ignore-paths',
                        'rules-table',
                        'words',
                        'advisories',
                        'licenses',
                        'eslint-config',
                    ]),
                })
                .superRefine((row, context) => {
                    if (row.key !== undefined && row.table !== undefined)
                        context.addIssue({
                            code: 'custom',
                            message: 'A takeover row selects either a key or a table.',
                        });
                    if ((row.key !== undefined || row.table !== undefined) && !row.shared)
                        context.addIssue({
                            code: 'custom',
                            message: 'A selected key or table must preserve its shared file.',
                        });
                }),
        )
        .optional(),
    ...installerFields,
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
        per_scope: z.boolean().default(false),
        header: z.boolean().default(true),
        needs: z.string().optional(),
        code_files: z.array(z.string().min(1)).default([]),
        selectors: z.array(selectorSchema).default([]),
    })
    .refine(
        (config) => config.fragment || config.template !== undefined,
        'A config that is not a fragment names its template.',
    );

const SENTENCE_MIN = 12;
const sentence = z.string().min(SENTENCE_MIN);

const stringListTable = z.record(z.string(), z.array(z.string()));

const checkFields = z.strictObject({
    title: z.string().min(1).optional(),
    name: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
    level: z.enum(['recommended', 'all']),
    stage: z.enum(['commit', 'push', 'manual', 'message']),
    runs: z.enum(['per-file-list', 'per-scope', 'once']).default('per-file-list'),
    command: commandSchema.optional(),
    isolated_files: z.boolean().optional(),
    // true: an analysis reads only its files, so its result may be cached; false: a command's verdict depends on more.
    cached: z.boolean().optional(),
    file_prefix: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    fix_command: commandSchema.optional(),
    fix_order: z.enum(['codemod', 'imports', 'manifest', 'format']).optional(),
    fix_findings_exit_codes: findingExitCodesSchema.optional(),
    findings_exit_codes: findingExitCodesSchema.optional(),
    engine: z.enum(['integrity', 'naming', 'structure', 'prose']).optional(),
    analysis: z.string().optional(),
    reported_by: z.string().optional(),
    takes_over: z.string().optional(),
    needs: z.string().optional(),
    limit: z.string().optional(),
    count_regex: z.string().optional(),
    tool_errors: z.string().optional(),
    // true: the check reads git and is skipped in a folder with no .git; false: it stands in for one and runs only there.
    needs_git: z.boolean().optional(),
    requires: z.enum(['build', 'docker', 'network']).optional(),
    waits_for: z.string().optional(),
    platform: z.array(z.enum(['macos', 'linux', 'windows'])).optional(),
    tool: z.string().optional(),
    claims: claimsSchema.optional(),
    output: outputSchema.optional(),
    cwd: z.enum(['root', 'scope']).optional(),
    nested_config: z
        .string()
        .regex(/^[A-Za-z0-9_.-]+$/u)
        .optional(),
    exclude_setting: z.string().optional(),
    coverage: stringList,
    summary: sentence,
    example: z.string().trim().min(1),
    why: sentence,
    help: sentence,
    searched: z.array(z.string()).optional(),
});

const absent = z.never().optional();
const checkSchema = z.union(
    [
        checkFields.extend({ command: commandSchema, engine: absent, analysis: absent, reported_by: absent }),
        checkFields.extend({
            tool: z.string().min(1),
            analysis: z.enum([
                'typescript',
                'javascript',
                'commit-messages',
                'gitleaks-history',
                'verified-secrets',
                'swiftlint',
                'actions',
            ]),
            command: absent,
            engine: absent,
            reported_by: absent,
        }),
        checkFields.extend({
            engine: z.enum(['integrity', 'naming', 'structure', 'prose']),
            command: absent,
            reported_by: absent,
        }),
        checkFields.extend({
            reported_by: z.string().min(1),
            command: absent,
            engine: absent,
            analysis: absent,
            tool: absent,
            takes_over: absent,
        }),
    ],
    { error: 'Choose one command, tool analysis, engine, or reported_by owner without combining execution forms.' },
);

// How init fills a setting from the repository: a dependency that turns it on, dependencies that each name a value,
// the first folder that exists, or folders that each name a value (K-93).
const settingDetectSchema = z.strictObject({
    dependency: z.string().min(1).optional(),
    dependencies: z.record(z.string().min(1), z.unknown()).optional(),
    folders: z.array(z.string().min(1)).optional(),
    folder_values: z.record(z.string().min(1), z.unknown()).optional(),
});

// A path-scoped naming rule a configuration ships, in the shape gspot.toml writes under [[naming.rules]] (K-50).
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
    kind: z.enum(['number', 'string', 'boolean', 'list', 'table']),
    direction: z.enum(['ceiling', 'floor', 'loosening', 'tightening', 'neutral', 'per-rule']),
    default: z.unknown().optional(),
    summary: sentence,
    languages: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    // The architecture role the folder a setting names plays, so a template finds it without naming the setting.
    role: z.enum(['harness']).optional(),
    detect: settingDetectSchema.optional(),
});

// The shape of a configuration manifest.toml after validation.

// An untracked path: .gspot, then one or more names, and at most a trailing slash; no . or .. segment.
function isUntrackedPath(path: string): boolean {
    const [root, ...names] = (path.endsWith('/') ? path.slice(0, -1) : path).split('/');
    return (
        root === '.gspot' &&
        names.length > 0 &&
        names.every((name) => /^[A-Za-z0-9._-]+$/u.test(name) && name !== '.' && name !== '..')
    );
}

type ExecutionFields<Check> = Check extends unknown ? Omit<Check, 'example'> : never;

export const manifestSchema = z.strictObject({
    untracked: z
        .array(z.string().refine((path) => isUntrackedPath(path), 'Untracked paths must stay inside .gspot.'))
        .default([]),
    configuration: z.strictObject({
        name: z.string().regex(/^[a-z0-9-]+$/),
        kind: z.enum(['language', 'framework', 'platform', 'tool', 'library', 'database', 'policy']),
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
    detect: z
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
        }),
    claims: claimsSchema.default({
        extensions: [],
        filenames: [],
        tags: [],
        paths: [],
        from_languages: false,
        natures: ['source'],
    }),
    tools: z.array(toolSchema).default([]),
    configs: z.array(configSchema).default([]),
    checks: z.array(checkSchema).default([]),
    settings: z.array(settingSchema).default([]),
    // The naming rules of the framework or platform, merged after the shipped policy and before the repository's own.
    naming: z.strictObject({ rules: z.array(manifestNamingRule).default([]) }).optional(),
    // Files a dead-code scan starts from, relative to the scope, for the code this configuration knows.
    entry_files: stringList,
    coverage: stringListTable.default({}),
    rule_files: stringListTable.default({}),
    required_rules: stringListTable.default({}),
});

export const INSTALLER_KEYS = Object.keys(installerFields) as (keyof typeof installerFields)[];

export type Stage = RawCheck['stage'];

export type FixOrder = 'codemod' | 'imports' | 'manifest' | 'format';

export type Claims = RawManifest['claims'];

export type ConfigurationTarget = RawManifest['configs'][number];

export type FragmentSelector = z.infer<typeof selectorSchema>;

export type PointerSpec = NonNullable<ConfigurationTarget['pointer']>;

/** Validated execution variants. Repository-defined commands do not require reference examples. */
export type CheckSpec = ExecutionFields<Defined<RawCheck>> & { example?: string };

export type SettingSpec = Defined<RawManifest['settings'][number]>;

/** manifest.toml as the schema accepts it. */
export type RawManifest = z.infer<typeof manifestSchema>;

/** One [[tools]] entry as written. */
export type RawTool = RawManifest['tools'][number];

/** One [[checks]] entry as written. */
export type RawCheck = RawManifest['checks'][number];
