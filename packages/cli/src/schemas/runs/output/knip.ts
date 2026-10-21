import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { type KnipReport, type KnipSymbol } from '#cli/types/runs/output.ts';

const knipSymbolSchema = z.object({
    name: z.string().min(1),
    namespace: z.string().optional(),
    line: z.number().int().positive().optional(),
    col: z.number().int().positive().optional(),
} satisfies SchemaShape<KnipSymbol>);

export const knipReportSchema = z.strictObject({
    issues: z.array(
        z.strictObject({
            file: z.string().min(1),
            owners: z
                .array(
                    z.object({ name: z.string() } satisfies SchemaShape<
                        NonNullable<KnipReport['issues'][number]['owners']>[number]
                    >),
                )
                .optional(),
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
        } satisfies SchemaShape<KnipReport['issues'][number]>),
    ),
} satisfies SchemaShape<KnipReport>) satisfies z.ZodType<KnipReport>;
