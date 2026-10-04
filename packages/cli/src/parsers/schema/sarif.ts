import { z } from 'zod';

const locationSchema = z.object({
    uri: z.string().optional(),
    uriBaseId: z.string().optional(),
    index: z.number().int().nonnegative().optional(),
});
const resultSchema = z.object({
    ruleId: z.string().optional(),
    message: z.object({ text: z.string().optional() }).optional(),
    locations: z
        .array(
            z.object({
                physicalLocation: z
                    .object({
                        artifactLocation: locationSchema.optional(),
                        region: z
                            .object({
                                startLine: z.number().int().positive().optional(),
                                startColumn: z.number().int().positive().optional(),
                                charOffset: z.number().int().min(-1).default(-1),
                            })
                            .default({ charOffset: -1 }),
                    })
                    .optional(),
            }),
        )
        .optional(),
});
const runSchema = z.object({
    results: z.array(resultSchema),
    artifacts: z.array(z.object({ location: locationSchema.optional(), encoding: z.string().optional() })).optional(),
    defaultEncoding: z.string().optional(),
    columnKind: z.enum(['utf16CodeUnits', 'unicodeCodePoints']).optional(),
    newlineSequences: z.array(z.string().min(1)).min(1).optional(),
    originalUriBaseIds: z.record(z.string(), locationSchema).optional(),
    invocations: z
        .array(
            z.object({
                executionSuccessful: z.boolean().optional(),
                toolExecutionNotifications: z
                    .array(
                        z.object({
                            level: z.string().optional(),
                            message: z.object({ text: z.string().optional() }).optional(),
                        }),
                    )
                    .optional(),
            }),
        )
        .optional(),
});

/** Validate SARIF version 2.1.0 and the source metadata needed for findings. */
export const sarifLogSchema = z.object({ version: z.literal('2.1.0'), runs: z.array(runSchema).min(1) });
