// The zod schema of manifest.toml, and the refusals the loader applies.
import { z } from 'zod';

const stringList = z.array(z.string()).default([]);

const claimsSchema = z.strictObject({
    extensions: stringList,
    filenames: stringList,
    tags: stringList,
    paths: stringList,
    from_languages: z.boolean().default(false),
    natures: z.array(z.enum(['source', 'generated', 'vendored', 'binary'])).default(['source']),
});

const outputSchema = z.strictObject({
    format: z.enum(['regex', 'grouped', 'eslint-json', 'json', 'lines', 'none']),
    items: z.string().optional(),
    children: z.string().optional(),
    line_base: z.union([z.literal(0), z.literal(1)]).optional(),
    file_is: z.enum(['path', 'link', 'history']).optional(),
    fields: z
        .strictObject({
            file: z.string().optional(),
            line: z.string().optional(),
            column: z.string().optional(),
            rule: z.string().optional(),
            message: z.string().optional(),
        })
        .optional(),
    pattern: z.string().optional(),
    file_pattern: z.string().optional(),
    fixable: z.string().optional(),
    message: z.string().optional(),
});

const toolSchema = z.strictObject({
    name: z.string(),
    kind: z.enum(['binary', 'library']).default('binary'),
    version: z.string().optional(),
    floor: z.string().optional(),
    provider: z.literal('host').optional(),
    windows: z.boolean().default(true),
    version_command: z.array(z.string()).optional(),
    version_regex: z.string().optional(),
    npm: z.string().optional(),
    pypi: z.string().optional(),
    mise: z.string().optional(),
    brew: z.string().optional(),
    apt: z.string().optional(),
    cargo: z.string().optional(),
    github: z.string().optional(),
    winget: z.string().optional(),
    scoop: z.string().optional(),
    ubi: z.string().optional(),
});

const stubSchema = z.strictObject({
    path: z.string(),
    body: z.string().optional(),
    merge: z.record(z.string(), z.unknown()).optional(),
    copy: z.boolean().optional(),
});

const configSchema = z.strictObject({
    template: z.string(),
    target: z.string(),
    stub: stubSchema.optional(),
    fragment: z.boolean().default(false),
    per_scope: z.boolean().default(false),
    executable: z.boolean().default(false),
    header: z.boolean().default(true),
    needs: z.string().optional(),
});

const SENTENCE_MIN = 12;
const sentence = z.string().min(SENTENCE_MIN);

const stringListTable = z.record(z.string(), z.array(z.string()));

const checkSchema = z.strictObject({
    name: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
    stage: z.enum(['commit', 'push', 'manual', 'message']),
    runs: z.enum(['per-file-list', 'per-scope', 'once']).default('per-file-list'),
    command: z.array(z.string()).optional(),
    fix_command: z.array(z.string()).min(1).optional(),
    fix_order: z.enum(['codemod', 'imports', 'manifest', 'format']).optional(),
    baseline_file: z.string().optional(),
    baseline_command: z.array(z.string()).optional(),
    prune_command: z.array(z.string()).optional(),
    engine: z.string().optional(),
    analysis: z.string().optional(),
    reported_by: z.string().optional(),
    takes_over: z.string().optional(),
    limit: z.string().optional(),
    count_regex: z.string().optional(),
    tool_errors: z.string().optional(),
    requires: z.enum(['build', 'docker', 'network']).optional(),
    platform: z.array(z.enum(['macos', 'linux', 'windows'])).optional(),
    tool: z.string().optional(),
    claims: claimsSchema.optional(),
    output: outputSchema.optional(),
    cwd: z.enum(['root', 'scope']).optional(),
    exclude_setting: z.string().optional(),
    coverage: stringList,
    summary: sentence,
    why: sentence,
    help: sentence,
    searched: z.array(z.string()).optional(),
});

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
    preset: z.strictObject({
        name: z.string().regex(/^[a-z0-9-]+$/),
        kind: z.enum(['language', 'framework', 'platform', 'tool', 'library', 'database', 'concern']),
        title: z.string(),
        requires: stringList,
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
