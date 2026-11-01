import { z } from 'zod';
import semver from 'semver';
import { GIT_MODES } from '#cli/config/repository/files.ts';
import { PACKAGE_MANAGERS } from '#cli/config/repository/javascript.ts';

export const gitFileSchema = z.object({
    mode: z.enum(GIT_MODES),
    hash: z.string(),
    path: z.string(),
});

export const gitIndexFileSchema = gitFileSchema.extend({
    stage: z.coerce.number(),
});

const exactVersionSchema = z
    .string()
    .refine((value) => semver.valid(value) !== null, 'Package manager version must be exact.');

export const packageManagerPinSchema = z.strictObject({
    name: z.enum(PACKAGE_MANAGERS),
    version: z.string().optional(),
});

export const packageManagerSchema = packageManagerPinSchema.extend({
    version: exactVersionSchema,
});

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
