import { z } from 'zod';

export const packageDescriptionSchema = z.object({
    targets: z
        .object({
            name: z.string().min(1),
            path: z.string(),
            type: z.string(),
            module_type: z.string(),
            sources: z.string().array(),
        })
        .array(),
});
const linesSchema = z.object({
    count: z.number().int().nonnegative(),
    covered: z.number().int().nonnegative(),
});
const summarySchema = z.object({
    lines: linesSchema,
});
const fileSchema = z.object({
    filename: z.string(),
    summary: summarySchema,
});

export const swiftCoverageSchema = z.object({
    data: z
        .object({
            files: fileSchema.array(),
        })
        .array(),
});

export const xccovSchema = z.object({
    targets: z.object({ name: z.string().min(1), lineCoverage: z.number().min(0).max(1) }).array(),
});
