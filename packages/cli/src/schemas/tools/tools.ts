import { z } from 'zod';

export const lintRuleDocsSchema = z.object({
    description: z.string().exactOptional(),
    url: z.string().exactOptional(),
    why: z.string().exactOptional(),
    fix: z.string().exactOptional(),
    example: z.string().exactOptional(),
    explanation: z.string().exactOptional(),
});

export const ruleDocumentationSchema = z.object({
    docs: lintRuleDocsSchema.exactOptional(),
    url: z.string().exactOptional(),
});

export const ruffRuleSchema = z.object({
    name: z.string(),
    summary: z.string(),
    explanation: z.string(),
});

export const installedRulesSchema = z.object({
    properties: z.record(z.string(), z.object({ description: z.string().optional() })),
});
