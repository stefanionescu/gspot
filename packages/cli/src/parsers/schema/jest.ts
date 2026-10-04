import { z } from 'zod';
import { percentageSchema } from '#cli/parsers/schema/primitives.ts';

const metric = z.object({ pct: percentageSchema });

export const coverageSchema = z.object({
    total: z.object({ lines: metric, branches: metric, functions: metric, statements: metric }),
});

export const reportSchema = z.object({
    success: z.boolean(),
    numTotalTests: z.number().int().nonnegative(),
    numRuntimeErrorTestSuites: z.number().int().nonnegative(),
    testResults: z.array(
        z.object({
            name: z.string().min(1),
            assertionResults: z.array(
                z.object({
                    fullName: z.string(),
                    status: z.enum(['passed', 'failed', 'skipped', 'pending', 'todo', 'disabled', 'focused']),
                    failureMessages: z.array(z.string()),
                    location: z
                        .object({ line: z.number().int().positive(), column: z.number().int().nonnegative() })
                        .nullable()
                        .optional(),
                }),
            ),
        }),
    ),
});

/** Required coverage floors read by the native Jest check. */
export const thresholdsSchema = z.object({
    coverage: z.object({
        lines: percentageSchema,
        branches: percentageSchema,
        functions: percentageSchema,
        statements: percentageSchema,
    }),
});
