import { z } from 'zod';

// A comparison reads one configuration, or a before and an after.
const MAX_SOURCES = 2;

export const previewRequestSchema = z.strictObject({
    root: z.string().min(1),
    path: z.string().min(1),
    sources: z.array(z.string()).min(1).max(MAX_SOURCES),
});
export const eslintPreviewResponse = z.array(z.record(z.string(), z.json()));

export const eslintCoverageRequest = z.strictObject({
    root: z.string().min(1),
    paths: z.array(z.string().min(1)),
});
export const eslintCoverageResponse = z.record(z.string(), z.array(z.string()));

export const configurationRequest = z.discriminatedUnion('operation', [
    previewRequestSchema.extend({ tool: z.literal('eslint'), operation: z.literal('preview-rules') }),
    eslintCoverageRequest.extend({ tool: z.literal('eslint'), operation: z.literal('coverage') }),
]);
