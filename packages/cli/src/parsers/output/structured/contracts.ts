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
                            })
                            .optional(),
                    })
                    .optional(),
            }),
        )
        .optional(),
});

const runSchema = z.object({
    results: z.array(resultSchema),
    artifacts: z.array(z.object({ location: locationSchema.optional() })).optional(),
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

const positionSchema = z.object({ line: z.number().int().positive(), col: z.number().int().positive() });

/** Validate SARIF version 2.1.0 and the source metadata needed for findings. */
export const sarifLogSchema = z.object({ version: z.literal('2.1.0'), runs: z.array(runSchema).min(1) });

export const semgrepReportSchema = z.object({
    results: z.array(
        z.object({
            check_id: z.string().min(1),
            path: z.string().min(1),
            start: positionSchema,
            extra: z.object({ message: z.string().min(1) }),
        }),
    ),
    errors: z.array(
        z.object({
            code: z.number().int(),
            type: z.union([z.string(), z.tuple([z.string(), z.unknown()])]),
            message: z.string().min(1),
            path: z.string().min(1).optional(),
            spans: z.array(z.object({ file: z.string().min(1), start: positionSchema })).optional(),
        }),
    ),
});
