import { z } from 'zod';
import type { BunPackage } from '#cli/types/install/npm.ts';
import { npmLockSchema, bunLockSchema, pnpmLockSchema } from '#cli/schemas/parsers/lockfiles.ts';

export const bunPackageSchema = z.tuple([
    z.string(),
    z.string(),
    z.record(z.string(), z.unknown()),
    z.string(),
]) satisfies z.ZodType<BunPackage>;

export const npmToolLockSchemas = { npm: npmLockSchema, bun: bunLockSchema, pnpm: pnpmLockSchema } as const;
