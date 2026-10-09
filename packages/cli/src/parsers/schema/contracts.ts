import { z } from 'zod';
import { HASH_PATTERN } from '#cli/config/parsers/git.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';
import type { SettingField, SettingItems, SettingFields } from '#cli/types/parsers/settings.ts';

// Output parsing metadata shared by configuration and command checks.

export const outputSchema = z.strictObject({
    format: z.union([
        z.literal('regex').meta({
            description:
                'Read findings from lines matched by pattern and its named file, line, column, rule, and message groups.',
        }),
        z.literal('grouped').meta({
            description: 'Read a file heading matched by file_pattern, followed by findings matched by pattern.',
        }),
        z.literal('sarif').meta({ description: 'Read SARIF results, rule metadata, source locations, and fixes.' }),
        z.literal('knip').meta({ description: 'Read Knip JSON issue categories and source positions.' }),
        z
            .literal('semgrep')
            .meta({ description: 'Read Semgrep JSON results, locations, rule IDs, messages, and native fixes.' }),
        z
            .literal('trufflehog-json')
            .meta({ description: 'Read TruffleHog JSON findings while withholding raw secret output.' }),
        z.literal('typos').meta({ description: 'Read typos JSON and convert byte offsets to character columns.' }),
        z
            .literal('markdownlint')
            .meta({ description: 'Read markdownlint result objects and their rule and source locations.' }),
        z
            .literal('json')
            .meta({ description: 'Read JSON findings using items, children, and fields to select report entries.' }),
        z
            .literal('lines')
            .meta({ description: 'Report each nonempty output line as a finding without a source location.' }),
        z.literal('none').meta({ description: 'Use the exit status without parsing output into findings.' }),
    ]),
    items: z.string().optional(),
    children: z.string().optional(),
    line_base: z.union([z.literal(0), z.literal(1)]).optional(),
    // Paths in the repository, link targets, and paths in past commits have different existence requirements.
    file_type: z.enum(['path', 'link', 'history']).optional(),
    fields: z
        .strictObject({
            file: z.string().optional(),
            line: z.string().optional(),
            column: z.string().optional(),
            rule: z.string().optional(),
            message: z.string().optional(),
            fixable: z.string().optional(),
        })
        .optional(),
    pattern: z.string().optional(),
    file_pattern: z.string().optional(),
    fixable: z.string().optional(),
    message: z.string().optional(),
});

export const findingSchema = z.strictObject({
    check: z.string(),
    file: z.string(),
    line: z.number().int().optional(),
    column: z.number().int().optional(),
    rule: z.string().optional(),
    message: z.string(),
    help: z.string().optional(),
    fixable: z.boolean(),
});

export const resultSchema = z.strictObject({
    check: z.string(),
    scope: z.string(),
    status: z.enum(['passed', 'failed', 'missing', 'skipped', 'error']),
    fileCount: z.number().int(),
    files: z
        .array(z.string())
        .optional()
        .meta({ description: 'Repository-relative files whose analysis was confirmed by the built-in check.' }),
    duration: z.number(),
    findings: z.array(findingSchema),
    note: z.string().optional(),
    reproduce: z.string().optional(),
    command: z.array(z.string()).optional(),
});

export const markdownlintReportSchema = z.array(
    z.object({
        fileName: z.string().min(1),
        lineNumber: z.number().int().positive(),
        ruleNames: z.tuple([z.string().min(1)]).rest(z.string().min(1)),
        ruleDescription: z.string().min(1),
        errorDetail: z.string().nullable(),
        errorContext: z.string().nullable(),
        errorRange: z.tuple([z.number().int().positive(), z.number().int().nonnegative()]).nullable(),
        fixInfo: z.record(z.string(), z.unknown()).nullable(),
        severity: z.enum(['error', 'warning']),
    }),
);

export const trufflehogResultSchema = z.object({
    DetectorName: z.string().min(1),
    Verified: z.literal(true),
    SourceMetadata: z.object({ Data: z.object({ JsonEnumerator: z.object({ metadata: z.string() }) }) }),
});

export const historyMetadataSchema = z.object({
    commit: z.string().regex(HASH_PATTERN),
    file: z.string(),
});

export const typosEntrySchema = z.object({
    type: z.literal('typo'),
    path: z.string().min(1),
    line_num: z.number().int().positive().optional(),
    byte_offset: z.number().int().nonnegative(),
    typo: z.string().min(1),
    corrections: z.array(z.string()).nullable(),
});

export const knipSymbolSchema = z.object({
    name: z.string().min(1),
    namespace: z.string().optional(),
    kind: z.string().optional(),
    specifier: z.string().optional(),
    line: z.number().int().positive().optional(),
    col: z.number().int().positive().optional(),
    pos: z.number().int().nonnegative().optional(),
});

export const knipReportSchema = z.strictObject({
    issues: z.array(
        z.strictObject({
            file: z.string().min(1),
            owners: z.array(z.object({ name: z.string() })).optional(),
            binaries: z.array(knipSymbolSchema).optional(),
            catalog: z.array(knipSymbolSchema).optional(),
            catalogReferences: z.array(knipSymbolSchema).optional(),
            cycles: z.array(z.array(knipSymbolSchema).min(1)).optional(),
            dependencies: z.array(knipSymbolSchema).optional(),
            devDependencies: z.array(knipSymbolSchema).optional(),
            duplicates: z.array(z.array(knipSymbolSchema).min(1)).optional(),
            enumMembers: z.array(knipSymbolSchema).optional(),
            exports: z.array(knipSymbolSchema).optional(),
            files: z.array(knipSymbolSchema).optional(),
            namespaceMembers: z.array(knipSymbolSchema).optional(),
            nsExports: z.array(knipSymbolSchema).optional(),
            nsTypes: z.array(knipSymbolSchema).optional(),
            optionalPeerDependencies: z.array(knipSymbolSchema).optional(),
            types: z.array(knipSymbolSchema).optional(),
            unlisted: z.array(knipSymbolSchema).optional(),
            unresolved: z.array(knipSymbolSchema).optional(),
        }),
    ),
});

export const alertsSchema = z.record(
    z.string().min(1),
    z.array(
        z.object({
            Line: z.number().int().positive(),
            Span: z.tuple([z.number().int().positive(), z.number().int().positive()]),
            Check: z.string().min(1),
            Message: z.string().min(1),
        }),
    ),
);

/** The public policy and check levels. Preview rules have no supported level. */
export const levelSchema = z.enum(['recommended', 'all']);

/** Operating systems supported by declared checks and generated CI. */
export const operatingSystemSchema = z.enum(OPERATING_SYSTEMS.map((system) => system.name));

/** Package and task runners supported by the public runner setting. */
export const runnerSchema = z.enum(['mise', 'npm', 'bun', 'pnpm', 'yarn']);

/** Constraints declared by a setting's owning configuration. */
export const settingValidationSchema = z.strictObject({
    enum: z
        .array(z.union([z.string(), z.number(), z.boolean()]))
        .min(1)
        .optional(),
    pattern: z
        .string()
        .superRefine((pattern, context) => {
            try {
                new RegExp(pattern, 'u');
            } catch {
                context.addIssue({ code: 'custom', message: 'Use a valid Unicode regular expression.' });
            }
        })
        .optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    integer: z.boolean().optional(),
    path: z.boolean().optional(),
    message: z.string().min(1).optional(),
});

/** Primitive field names in authored setting item declarations. */
export const settingPrimitiveSchema = z.enum(['string', 'path', 'number', 'boolean']);

/** Types a configuration may declare for one authored setting. */
export const settingTypeSchema = z.enum(['number', 'string', 'path', 'boolean', 'list', 'table']);

/** Optionality and constraints belong to the declared field, not its readers. */
export const settingFieldOptionsSchema = z.strictObject({
    optional: z.boolean().optional(),
    validation: settingValidationSchema.optional(),
});

/** Typed record fields may contain other declared records and lists. */
export const settingFieldSchema: z.ZodType<SettingField> = z.lazy(() =>
    z.discriminatedUnion('type', [
        settingFieldOptionsSchema.extend({ type: settingPrimitiveSchema }),
        settingFieldOptionsSchema.extend({ type: z.literal('list'), items: settingItemsSchema }),
        settingFieldOptionsSchema.extend({ type: z.literal('table'), fields: settingFieldsSchema }),
    ]),
);

/** Every record field has a type; undeclared field values are refused. */
export const settingFieldsSchema: z.ZodType<SettingFields> = z.record(
    z.string().min(1),
    z.union([settingPrimitiveSchema, settingFieldSchema]),
);

/** A retained list declares strings, scope paths, or a typed record. */
export const settingItemsSchema: z.ZodType<SettingItems> = z.union([z.enum(['string', 'path']), settingFieldsSchema]);

/** Compiler metadata shared by manifest declarations and runtime value validation. */
export const settingValueDeclarationSchema = z.strictObject({
    type: settingTypeSchema,
    path_role: z.enum(['source', 'destination']).optional(),
    validation: settingValidationSchema.prefault({}),
    items: z.union([settingItemsSchema, z.literal('native')]).optional(),
    default: z.unknown().optional(),
    default_all: z.unknown().optional(),
});

/** Rule values captured before serialization, grouped by their declared manifest paths. */
export const ruleSettingsSchema = z.record(z.string(), z.record(z.string(), z.json()));
