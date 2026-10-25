import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { ValeOutput } from '#cli/types/checks/general/prose.ts';

const resultSchema = z.object({
    Line: z.number().int().positive(),
    Span: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    Check: z.string().min(1),
    Message: z.string().min(1),
} satisfies SchemaShape<
    Record<string, { Line: number; Span: [number, number]; Check: string; Message: string }[]>[string][number]
>);

export const valeReportSchema = z.record(z.string().min(1), resultSchema.array()) satisfies z.ZodType<ValeOutput>;
