import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { CiJob } from '#cli/types/repository/setup.ts';

const ciStepSchema = z.object({ run: z.string().optional() } satisfies SchemaShape<{ run?: string | undefined }>);

export const ciJobSchema = z.object({
    script: (
        z.union([
            z.string(),
            z.array(z.unknown()).transform((commands) => commands.filter((command) => typeof command === 'string')),
        ]) satisfies z.ZodType<string | string[]>
    ).optional(),
    steps: z
        .array(z.unknown())
        .transform((steps) =>
            steps.flatMap((step) => {
                const parsed = ciStepSchema.safeParse(step);
                return parsed.success ? [parsed.data] : [];
            }),
        )
        .optional(),
    extends: z.unknown().optional(),
} satisfies SchemaShape<CiJob>);

export const ciDocumentSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;
