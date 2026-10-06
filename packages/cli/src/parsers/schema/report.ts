import { z } from 'zod';
import { HASH_PATTERN } from '#cli/config/parsers/git.ts';
import { ESLINT_WARN, ESLINT_ERROR } from '#cli/config/parsers/output.ts';

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
        .meta({ description: 'Repository-relative files whose analysis was confirmed by the engine.' }),
    duration: z.number(),
    findings: z.array(findingSchema),
    note: z.string().optional(),
    reproduce: z.string().optional(),
    command: z.array(z.string()).optional(),
});

export const eslintDiagnosticSchema = z.object({
    ruleId: z.string().nullable(),
    line: z.number().int().positive().optional(),
    column: z.number().int().positive().optional(),
    message: z.string(),
    fix: z.unknown().optional(),
    severity: z.union([z.literal(ESLINT_WARN), z.literal(ESLINT_ERROR)]),
});
export const eslintReportSchema = z.array(
    z.object({ filePath: z.string().min(1), messages: z.array(eslintDiagnosticSchema) }),
);

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
