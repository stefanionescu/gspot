import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { type MarkdownlintOutput } from '#cli/types/runs/output/outputs.ts';

export const markdownlintOutputSchema = z
    .object({
        fileName: z.string().min(1),
        lineNumber: z.number().int().positive(),
        ruleNames: z.tuple([z.string().min(1)]).rest(z.string().min(1)),
        ruleDescription: z.string().min(1),
        errorDetail: z.string().nullable(),
        errorContext: z.string().nullable(),
        errorRange: z.tuple([z.number().int().positive(), z.number().int().nonnegative()]).nullable(),
        fixInfo: z.record(z.string(), z.unknown()).nullable(),
    } satisfies SchemaShape<MarkdownlintOutput>)
    .array() satisfies z.ZodType<MarkdownlintOutput[]>;
