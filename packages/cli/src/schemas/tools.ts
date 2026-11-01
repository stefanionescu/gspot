import { z } from 'zod';
import { npmLockfileSchema, bunLockfileSchema, pnpmLockfileSchema } from '#cli/schemas/parsers.ts';

const miseVersionSchema = z.looseObject({ version: z.string() });

export const miseLockfileSchema = z.looseObject({
    tools: z.record(z.string(), miseVersionSchema.array()),
});

const uvIndexSchema = z.looseObject({ url: z.string() });

export const uvSettingsSchema = z.looseObject({
    'find-links': z.string().array().optional(),
    index: uvIndexSchema.array().optional(),
});

export const uvProjectSettingsSchema = z.object({
    tool: z
        .object({
            uv: uvSettingsSchema.default({}),
        })
        .default({ uv: {} }),
});

export const bunPackageSchema = z.tuple([z.string(), z.string(), z.record(z.string(), z.unknown()), z.string()]);

export const npmToolLockSchemas = { npm: npmLockfileSchema, bun: bunLockfileSchema, pnpm: pnpmLockfileSchema } as const;

export const npmToolPackageSchema = z.looseObject({
    name: z.string().optional(),
    version: z.string(),
    resolved: z.string().optional(),
    integrity: z.string(),
});

export const pnpmToolPackageSchema = z.looseObject({
    name: z.string().optional(),
    resolution: z.looseObject({ integrity: z.string(), tarball: z.string().optional() }),
});

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
