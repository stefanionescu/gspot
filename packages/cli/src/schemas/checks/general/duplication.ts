import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { CloneReport, CloneLocation } from '#cli/types/checks/general/duplication.ts';

const clonePlaceSchema = z.object({
    name: z.string().min(1),
    start: z.number().int().positive(),
} satisfies SchemaShape<CloneLocation>);

export const cloneReportSchema = z.object({
    duplicates: z
        .object({
            lines: z.number().int().positive(),
            firstFile: clonePlaceSchema,
            secondFile: clonePlaceSchema,
        } satisfies SchemaShape<CloneReport['duplicates'][number]>)
        .array(),
} satisfies SchemaShape<CloneReport>);
