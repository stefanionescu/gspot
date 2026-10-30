import { z } from 'zod';
import { npmLockfileSchema, bunLockfileSchema, pnpmLockfileSchema } from '#cli/schemas/parsers/projects.ts';

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
