import { z } from 'zod';

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
