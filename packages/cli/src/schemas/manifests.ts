import { z } from 'zod';
// The zod schema of manifest.toml, and the refusals the loader applies.
import { outputSchema } from '#cli/schemas/check-output.ts';
import { commandSchema, findingExitCodesSchema } from '#cli/schemas/commands.ts';

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
    suppression: z
        .strictObject({
            marker: suppressionPattern,
            reason: suppressionPattern,
            forbidden: z.boolean().optional(),
        })
        .optional(),
    env: z.record(z.string(), z.string()).optional(),
    query_packs: z.record(z.string().regex(/^[a-z][a-z0-9-]*$/u), z.string().regex(/^\d+\.\d+\.\d+$/u)).optional(),
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

const stubSchema = z
    .strictObject({
        path: z.string(),
        directories: z.array(z.string().min(1)).min(1).optional(),
        body: z.string().optional(),
        merge: z.record(z.string(), z.unknown()).optional(),
        copy: z.boolean().optional(),
        template: z.string().optional(),
    })
    .refine(
        (stub) =>
            stub.template === undefined ||
            (stub.body === undefined && stub.merge === undefined && stub.copy === undefined),
        'A template stub cannot also specify body, merge, or copy.',
    )
    .refine(
        (stub) =>
            stub.directories === undefined ||
            (stub.body !== undefined &&
                stub.merge === undefined &&
                stub.copy === undefined &&
                stub.template === undefined),
        'Directory stubs require a body without merge, copy, or template.',
    );

const configSchema = z.strictObject({
    template: z.string(),
    target: z.string(),
    rules_path: z.array(z.string()).optional(),
    stub: stubSchema.optional(),
    fragment: z.boolean().default(false),
    per_scope: z.boolean().default(false),
    header: z.boolean().default(true),
    needs: z.string().optional(),
});

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
    limit: z.string().optional(),
    count_regex: z.string().optional(),
    tool_errors: z.string().optional(),
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
            analysis: z.enum(['typescript', 'javascript', 'commit-messages', 'gitleaks-history', 'verified-secrets', 'swiftlint', 'actions']),
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

const settingSchema = z.strictObject({
    name: z.string(),
    kind: z.enum(['number', 'string', 'boolean', 'list', 'table']),
    direction: z.enum(['ceiling', 'floor', 'loosening', 'tightening', 'neutral', 'per-rule']),
    default: z.unknown().optional(),
    summary: sentence,
    languages: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
});

export const manifestSchema = z.strictObject({
    untracked: z
        .array(
            z
                .string()
                .regex(/^\.gspot\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\/?$/u)
                .refine(
                    (path) => !path.split('/').some((part) => part === '.' || part === '..'),
                    'Untracked paths must stay inside .gspot.',
                ),
        )
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
        })
        .default({ extensions: [], filenames: [], dependencies: [], shebangs: [], tags: [], paths: [] }),
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
    coverage: stringListTable.default({}),
    rule_files: stringListTable.default({}),
    required_rules: stringListTable.default({}),
});

export const INSTALLER_KEYS = Object.keys(installerFields) as (keyof typeof installerFields)[];
