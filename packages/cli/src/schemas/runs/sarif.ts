import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';

import type {
    SarifLog,
    SarifRun,
    SarifRegion,
    SarifResult,
    SarifMessage,
    SarifArtifact,
    SarifAnalysis,
    SarifNotification,
    SarifResultLocation,
    SarifArtifactLocation,
    SarifPhysicalLocation,
} from '#cli/types/runs/tool-reports.ts';

const messageSchema = z.object({
    text: z.string().optional(),
} satisfies SchemaShape<SarifMessage>);

const locationSchema = z.object({
    uri: z.string().optional(),
    uriBaseId: z.string().optional(),
    index: z.number().int().nonnegative().optional(),
} satisfies SchemaShape<SarifArtifactLocation>);

const regionSchema = z.object({
    startLine: z.number().int().positive().optional(),
    startColumn: z.number().int().positive().optional(),
} satisfies SchemaShape<SarifRegion>);

const physicalLocationSchema = z.object({
    artifactLocation: locationSchema.optional(),
    region: regionSchema.optional(),
} satisfies SchemaShape<SarifPhysicalLocation>);

const resultLocationSchema = z.object({
    physicalLocation: physicalLocationSchema.optional(),
} satisfies SchemaShape<SarifResultLocation>);

const sarifResultSchema = z.object({
    ruleId: z.string().optional(),
    message: messageSchema.optional(),
    locations: resultLocationSchema.array().optional(),
} satisfies SchemaShape<SarifResult>);

const artifactSchema = z.object({
    location: locationSchema.optional(),
} satisfies SchemaShape<SarifArtifact>);

const notificationSchema = z.object({
    level: z.string().optional(),
    message: messageSchema.optional(),
} satisfies SchemaShape<SarifNotification>);

const analysisSchema = z.object({
    executionSuccessful: z.boolean().optional(),
    toolExecutionNotifications: notificationSchema.array().optional(),
} satisfies SchemaShape<SarifAnalysis>);

const runSchema = z.object({
    results: sarifResultSchema.array(),
    artifacts: artifactSchema.array().optional(),
    originalUriBaseIds: z.record(z.string(), locationSchema).optional(),
    invocations: analysisSchema.array().optional(),
} satisfies SchemaShape<SarifRun>);

export const sarifLogSchema = z.object({
    version: z.literal('2.1.0'),
    runs: runSchema.array().min(1),
} satisfies SchemaShape<SarifLog>);
