import { z } from 'zod';

const ciStepSchema = z.object({ run: z.string().optional() });

export const ciJobSchema = z.object({
    script: z
        .union([
            z.string(),
            z
                .unknown()
                .array()
                .transform((commands) => commands.filter((command) => typeof command === 'string')),
        ])
        .optional(),
    steps: z
        .unknown()
        .array()
        .transform((steps) =>
            steps.flatMap((step) => {
                const parsed = ciStepSchema.safeParse(step);
                return parsed.success ? [parsed.data] : [];
            }),
        )
        .optional(),
    extends: z.unknown().optional(),
});

export const ciDocumentSchema = z.record(z.string(), z.unknown());
