import { z } from 'zod';

const knipSymbolSchema = z.object({
    name: z.string().min(1),
    namespace: z.string().optional(),
    line: z.number().int().positive().optional(),
    col: z.number().int().positive().optional(),
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
    line: z.number().int().positive(),
    col: z.number().int().positive(),
});

const messageSchema = z.object({ message: z.string().min(1) });

const spanSchema = z.object({ file: z.string().min(1), start: positionSchema });

const errorTypeSchema = z.union([z.string(), z.tuple([z.string(), z.unknown()])]);

const errorSchema = z.object({
    code: z.number().int(),
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

export const reportedTypoSchema = z.object({
    type: z.literal('typo'),
    path: z.string().min(1),
    line_num: z.number().int().positive().optional(),
    byte_offset: z.number().int().nonnegative(),
    typo: z.string().min(1),
    corrections: z.string().array().nullable(),
});

export const baselineSchema = z.record(
    z.string(),
    z.record(z.string(), z.record(z.string(), z.number().int().positive())),
);
