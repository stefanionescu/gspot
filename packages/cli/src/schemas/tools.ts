import { z } from 'zod';
import { TOOL_STATES } from '#cli/config/tools/programs.ts';
import { npmLockfileSchema, bunLockfileSchema, pnpmLockfileSchema } from '#cli/schemas/parsers.ts';

const miseVersionSchema = z.looseObject({ version: z.string() });

export const miseLockfileSchema = z.looseObject({
    tools: z.record(z.string(), miseVersionSchema.array()),
});

const uvIndexSchema = z.looseObject({ url: z.string(), default: z.boolean().optional() });

export const uvSettingsSchema = z.looseObject({
    'index-url': z.string().optional(),
    'extra-index-url': z.string().array().optional(),
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

export const npmReleaseSchema = z.looseObject({ time: z.record(z.string(), z.string()) });

export const pypiReleaseSchema = z.looseObject({
    urls: z.looseObject({ upload_time_iso_8601: z.string() }).array(),
});

export const ruleExplanationSchema = z.object({
    description: z.string().exactOptional(),
    url: z.string().exactOptional(),
    why: z.string().exactOptional(),
    fix: z.string().exactOptional(),
    example: z.string().exactOptional(),
    explanation: z.string().exactOptional(),
});

export const ruleDocumentationSchema = z.object({
    docs: ruleExplanationSchema.exactOptional(),
    url: z.string().exactOptional(),
});

export const valeRuleSchema = z.object({ message: z.string(), link: z.string().optional() });

export const ruffRuleSchema = z.object({
    name: z.string(),
    summary: z.string(),
    explanation: z.string(),
});

const installedRuleSchema = z.object({ description: z.string().optional() });

export const installedRulesSchema = z.object({
    properties: z.record(z.string(), installedRuleSchema),
});

export const toolInspectionSchema = z.strictObject({
    name: z.string(),
    state: z.enum(TOOL_STATES),
    want: z.string().optional(),
    found: z.string().optional(),
    path: z.string().optional(),
    help: z.string().optional(),
    note: z.string().optional(),
    minimumVersion: z.string().optional(),
});

export const hookStatusSchema = z.strictObject({
    ready: z.boolean(),
    text: z.string(),
    tool: z.string().optional(),
    lines: z.string().array().optional(),
});
