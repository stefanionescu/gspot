import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { BunPackage, NpmPackage, PnpmPackage } from '#cli/types/install/npm.ts';
import { npmLockSchema, bunLockSchema, pnpmLockSchema } from '#cli/schemas/parsers/projects/lockfiles.ts';

export const bunPackageSchema = z.tuple([
    z.string(),
    z.string(),
    z.record(z.string(), z.unknown()),
    z.string(),
]) satisfies z.ZodType<BunPackage>;

export const npmToolLockSchemas = { npm: npmLockSchema, bun: bunLockSchema, pnpm: pnpmLockSchema } as const;

export const npmToolPackageSchema = z.looseObject({
    name: z.string().optional(),
    version: z.string(),
    resolved: z.string().optional(),
    integrity: z.string(),
} satisfies SchemaShape<NpmPackage>);

export const pnpmToolPackageSchema = z.looseObject({
    name: z.string().optional(),
    resolution: z.looseObject({ integrity: z.string(), tarball: z.string().optional() } satisfies SchemaShape<
        PnpmPackage['resolution']
    >),
} satisfies SchemaShape<PnpmPackage>);
