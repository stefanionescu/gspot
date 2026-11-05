import { z } from 'zod';

import { CHECK_STATUSES, COMPARED_CONTENTS, SKIP_CAUSES } from '#cli/config/engine.ts';
import { STAGES } from '#cli/config/manifests.ts';
import { ignoreSchema } from '#cli/schemas/settings/file.ts';

const knipSymbolSchema = z.object({
    name: z.string().min(1),
    namespace: z.string().optional(),
    line: z.int().positive().optional(),
    col: z.int().positive().optional(),
});

const ownersSchema = z.object({ name: z.string() });

export const knipOutputSchema = z.strictObject({
    issues: z
        .strictObject({
            file: z.string().min(1),
            owners: ownersSchema.array().optional(),
            binaries: knipSymbolSchema.array().optional(),
            catalog: knipSymbolSchema.array().optional(),
            catalogReferences: knipSymbolSchema.array().optional(),
            cycles: knipSymbolSchema.array().min(1).array().optional(),
            dependencies: knipSymbolSchema.array().optional(),
            devDependencies: knipSymbolSchema.array().optional(),
            duplicates: knipSymbolSchema.array().min(1).array().optional(),
            enumMembers: knipSymbolSchema.array().optional(),
            exports: knipSymbolSchema.array().optional(),
            files: knipSymbolSchema.array().optional(),
            namespaceMembers: knipSymbolSchema.array().optional(),
            nsExports: knipSymbolSchema.array().optional(),
            nsTypes: knipSymbolSchema.array().optional(),
            optionalPeerDependencies: knipSymbolSchema.array().optional(),
            types: knipSymbolSchema.array().optional(),
            unlisted: knipSymbolSchema.array().optional(),
            unresolved: knipSymbolSchema.array().optional(),
        })
        .array(),
});

const positionSchema = z.object({
    line: z.int().positive(),
    col: z.int().positive(),
});

const messageSchema = z.object({ message: z.string().min(1) });

const spanSchema = z.object({ file: z.string().min(1), start: positionSchema });

const errorTypeSchema = z.union([z.string(), z.tuple([z.string(), z.unknown()])]);

const errorSchema = z.object({
    code: z.int(),
    type: errorTypeSchema,
    message: z.string().min(1),
    path: z.string().min(1).optional(),
    spans: spanSchema.array().optional(),
});

export const semgrepOutputSchema = z.object({
    results: z
        .object({
            check_id: z.string().min(1),
            path: z.string().min(1),
            start: positionSchema,
            extra: messageSchema,
        })
        .array(),
    errors: errorSchema.array(),
});

const valeAlertSchema = z.object({
    Line: z.int().positive(),
    Span: z.tuple([z.int().positive(), z.int().positive()]),
    Check: z.string().min(1),
    Message: z.string().min(1),
});

export const valeOutputSchema = z.record(z.string().min(1), valeAlertSchema.array());

export const reportedTypoSchema = z.object({
    type: z.literal('typo'),
    path: z.string().min(1),
    line_num: z.int().positive().optional(),
    byte_offset: z.int().nonnegative(),
    typo: z.string().min(1),
    corrections: z.string().array().nullable(),
});

const ruleCountsSchema = z.record(z.string(), z.int().positive());

export const baselineSchema = z.record(z.string(), z.record(z.string(), ruleCountsSchema));

export const checkStateSchema = z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('on') }),
    z.strictObject({ status: z.literal('skipped'), cause: z.enum([...SKIP_CAUSES, 'no-files']) }),
]);

const skipCauseSchema = z.enum([...SKIP_CAUSES, 'no-files']);

export const findingSchema = z.strictObject({
    check: z.string(),
    file: z.string(),
    message: z.string(),
    fixable: z.boolean(),
    explain: z.string().optional(),
    diff: z.string().optional(),
    line: z.int().optional(),
    column: z.int().optional(),
    rule: z.string().optional(),
    fingerprint: z.string().optional(),
    help: z.string().optional(),
});

export const reportedCheckSchema = z.strictObject({
    check: z.string(),
    scope: z.string(),
    status: z.enum(CHECK_STATUSES),
    fileCount: z.int(),
    files: z.string().array().readonly().optional(),
    duration: z.number(),
    findings: findingSchema.array().readonly(),
    help: z.string().optional(),
    note: z.string().optional(),
    stack: z.string().optional(),
    cause: skipCauseSchema.optional(),
    fixCommand: z.string().optional(),
    rerun: z.string().optional(),
    command: z.string().array().readonly().optional(),
});

const fixedFilesFields = { check: z.string(), changed: z.string().array() };

export const fixResultSchema = z.union([
    z.strictObject({ ...fixedFilesFields, status: z.enum(['changed', 'unchanged', 'skipped']) }),
    z.strictObject({ ...fixedFilesFields, status: z.enum(['failed', 'canceled']), note: z.string() }),
]);

export const fixReportSchema = z.strictObject({
    results: fixResultSchema.array(),
    changed: z.string().array(),
    broken: z.string().array(),
    conflicted: z.string().array(),
});

export const runReportSchema = z.strictObject({
    notes: z.string().array(),
    comparison: z.strictObject({ content: z.enum(COMPARED_CONTENTS), reference: z.string() }).optional(),
    version: z.string(),
    stages: z.enum(STAGES).array().readonly(),
    started: z.string(),
    duration: z.number(),
    checks: reportedCheckSchema.array().readonly(),
    skippedCount: z.partialRecord(skipCauseSchema, z.int()).readonly(),
    ignores: ignoreSchema.array().readonly(),
    baselined: z.record(z.string(), z.int()).readonly(),
    unstagedChanges: z.int(),
    partial: z.boolean(),
    failed: z.string().array().readonly(),
    exitCode: z.int(),
});
