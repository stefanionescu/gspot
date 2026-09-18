// The zod schema of gspot.toml. Pure: no transforms, so the JSON schema is generated from it.
import { z } from 'zod';

const reasoned = <T extends z.ZodTypeAny>(inner: T) =>
    z.union([inner, z.strictObject({ value: inner, reason: z.string() })]);

const reasonedNumber = reasoned(z.number());
const reasonedBoolean = reasoned(z.boolean());
const reasonedStringList = reasoned(z.array(z.string()));

const limitTable = z.record(z.string(), reasonedNumber);

const limitsSchema = z.record(z.string(), z.union([reasonedNumber, limitTable]));

const namingCategory = z.strictObject({
    max_chars: reasonedNumber.optional(),
    max_words: reasonedNumber.optional(),
    case: reasonedStringList.optional(),
});

const namingLanguage = z
    .object({
        max_chars: reasonedNumber.optional(),
        max_words: reasonedNumber.optional(),
        case: reasonedStringList.optional(),
    })
    .catchall(namingCategory);

const namingRule = z.strictObject({
    paths: z.array(z.string()).min(1),
    languages: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    names: z.array(z.string()).optional(),
    structural_prefix: z.string().optional(),
    allow_digits: z.boolean().optional(),
    allow_duplicate_words: z.boolean().optional(),
    exclude: z.boolean().optional(),
    case: z.array(z.string()).optional(),
    reason: z.string().optional(),
});

const namingSchema = z
    .object({
        banned_terms: z.array(z.string()).optional(),
        allowed: z.array(z.strictObject({ name: z.string(), reason: z.string() })).optional(),
        external: z.array(z.string()).optional(),
        reserved: z.array(z.strictObject({ term: z.string(), allowed_for: z.array(z.string()) })).optional(),
        remove_groups: z.array(z.strictObject({ group: z.string(), reason: z.string() })).optional(),
        contract_properties: z.array(z.strictObject({ file: z.string(), names: z.array(z.string()) })).optional(),
        rules: z.array(namingRule).optional(),
    })
    .catchall(namingLanguage);

const architectureSchema = z.strictObject({
    types_directory: z.string().optional(),
    elements: z.array(z.strictObject({ name: z.string(), paths: z.array(z.string()) })).optional(),
    allow: z
        .array(z.strictObject({ from: z.string(), to: z.array(z.string()), reason: z.string().optional() }))
        .optional(),
    roles: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
    contracts: z.array(z.record(z.string(), z.unknown())).optional(),
    package_roots: z.array(z.string()).optional(),
    route_directories: z.array(z.string()).optional(),
    shared_directories: z.array(z.string()).optional(),
    feature_contracts: z.array(z.string()).optional(),
    allowed_imports: z.array(z.strictObject({ from: z.string(), to: z.string(), reason: z.string() })).optional(),
});

const pathsWithReason = z.strictObject({ paths: z.array(z.string()).min(1), reason: z.string() });

const structureSchema = z.strictObject({
    reexports: z.enum(['none', 'index-only']).optional(),
    call_through_allowed: z
        .array(z.strictObject({ file: z.string(), name: z.string(), reason: z.string() }))
        .optional(),
    trivial_exemptions: z
        .array(
            z.strictObject({
                language: z.string().optional(),
                path: z.string(),
                names: z.array(z.string()),
                reason: z.string(),
            }),
        )
        .optional(),
    single_file_folder_allowed: z.array(pathsWithReason).optional(),
    prefix_collision_allowed: z.array(pathsWithReason).optional(),
    folder_name_allowed: z.array(pathsWithReason).optional(),
    python: z.record(z.string(), z.unknown()).optional(),
});

const formatSchema = z.strictObject({
    indent_style: z.enum(['space', 'tab']).optional(),
    indent_width: z.number().int().min(1).max(8).optional(),
    print_width: z.number().int().min(40).max(400).optional(),
    line_ending: z.enum(['lf', 'crlf']).optional(),
    final_newline: z.boolean().optional(),
    quotes: z.enum(['single', 'double']).optional(),
    trailing_comma: z.enum(['all', 'es5', 'none']).optional(),
    semicolons: z.boolean().optional(),
});

const proseSchema = z.strictObject({
    vocabulary: z.array(z.string()).optional(),
    disabled: z.array(z.strictObject({ rule: z.string(), reason: z.string() })).optional(),
});

const toolTable = z
    .object({
        enabled: reasonedBoolean.optional(),
        extra: z.object({ reason: z.string() }).catchall(z.unknown()).optional(),
    })
    .catchall(z.unknown());

const ignoreSchema = z.strictObject({
    check: z.string(),
    rule: z.string().optional(),
    finding: z.string().optional(),
    paths: z.array(z.string()).optional(),
    reason: z.string(),
});

const declareSchema = z.strictObject({
    paths: z.array(z.string()).min(1),
    produced_by: z.string().optional(),
    vendored: z.boolean().optional(),
    reason: z.string().optional(),
});

const checkSchema = z.strictObject({
    id: z.string(),
    command: z.array(z.string()).min(1),
    paths: z.array(z.string()).min(1),
    stage: z.enum(['commit', 'push', 'manual']),
    fix: z.array(z.string()).optional(),
    count_regex: z.string().optional(),
    requires: z.enum(['build', 'docker', 'network']).optional(),
    platform: z.array(z.enum(['macos', 'linux', 'windows'])).optional(),
    summary: z.string().optional(),
});

const scopeBody = {
    limits: limitsSchema.optional(),
    naming: namingSchema.optional(),
    architecture: architectureSchema.optional(),
    structure: structureSchema.optional(),
    tools: z.record(z.string(), toolTable).optional(),
    format: formatSchema.optional(),
};

const scopeSchema = z.strictObject({
    path: z.string(),
    presets: z.array(z.string()).optional(),
    ...scopeBody,
});

export const policySchema = z.strictObject({
    version: z.number().int(),
    presets: z.array(z.string()).optional(),
    scope: z.array(scopeSchema).optional(),
    ...scopeBody,
    prose: proseSchema.optional(),
    ignore: z.array(ignoreSchema).optional(),
    declare: z.array(declareSchema).optional(),
    check: z.array(checkSchema).optional(),
    hooks: z.strictObject({ manager: z.enum(['gspot', 'lefthook', 'husky', 'none']).optional() }).optional(),
    ci: z
        .strictObject({
            provider: z.enum(['github', 'none']).optional(),
            platforms: z.array(z.enum(['ubuntu', 'macos', 'windows'])).optional(),
        })
        .optional(),
    rules: z
        .strictObject({
            install: z.boolean().optional(),
            directory: z.string().optional(),
            project: z.string().optional(),
        })
        .optional(),
    editor: z.strictObject({ vscode: z.boolean().optional() }).optional(),
    coverage: z.strictObject({ strict: z.boolean().optional() }).optional(),
    runner: z.strictObject({ surface: z.enum(['mise', 'npm', 'bun', 'pnpm', 'uv', 'none']).optional() }).optional(),
});

export type RawPolicy = z.infer<typeof policySchema>;
export type RawScope = z.infer<typeof scopeSchema>;
export type RawLimits = z.infer<typeof limitsSchema>;
export type RawNaming = z.infer<typeof namingSchema>;
