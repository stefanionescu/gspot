import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { JscpdOutput, CloneLocation } from '#cli/types/checks/general/duplication.ts';

const cloneLocationSchema = z.object({
    name: z.string().min(1),
    start: z.number().int().positive(),
} satisfies SchemaShape<CloneLocation>);

export const jscpdOutputSchema = z.object({
    duplicates: z
        .object({
            lines: z.number().int().positive(),
            firstFile: cloneLocationSchema,
            secondFile: cloneLocationSchema,
        } satisfies SchemaShape<JscpdOutput['duplicates'][number]>)
        .array(),
} satisfies SchemaShape<JscpdOutput>);
