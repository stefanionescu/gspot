import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { type KnipReport, type KnipSymbol } from '#cli/types/runs/tool-reports.ts';

const knipSymbolSchema = z.object({
    name: z.string().min(1),
    namespace: z.string().optional(),
    line: z.number().int().positive().optional(),
    col: z.number().int().positive().optional(),
} satisfies SchemaShape<KnipSymbol>);
const ownersSchema = z.object({ name: z.string() } satisfies SchemaShape<
    NonNullable<KnipReport['issues'][number]['owners']>[number]
>);

export const knipReportSchema = z.strictObject({
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
        } satisfies SchemaShape<KnipReport['issues'][number]>)
        .array(),
} satisfies SchemaShape<KnipReport>);
