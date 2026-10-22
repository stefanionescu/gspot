import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';

import type {
    UvLockfile,
    BunLockfile,
    NpmLockfile,
    YarnPackage,
    PnpmLockfile,
    DependencySections,
} from '#cli/types/parsers/projects/lockfiles.ts';

export const dependencySectionsSchema = z.looseObject({
    dependencies: z.record(z.string(), z.unknown()).optional(),
    devDependencies: z.record(z.string(), z.unknown()).optional(),
    optionalDependencies: z.record(z.string(), z.unknown()).optional(),
} satisfies SchemaShape<DependencySections>) satisfies z.ZodType<DependencySections>;

export const npmLockSchema = z.looseObject({
    packages: z.record(z.string(), z.looseObject({ version: z.string().optional() })).default({}),
} satisfies SchemaShape<NpmLockfile>) satisfies z.ZodType<NpmLockfile>;

export const bunLockSchema = z.looseObject({
    workspaces: z.record(z.string(), z.unknown()).default({}),
    packages: z.record(z.string(), z.array(z.unknown())).default({}),
} satisfies SchemaShape<BunLockfile>) satisfies z.ZodType<BunLockfile>;

export const pnpmLockSchema = z.looseObject({
    importers: z.record(z.string(), z.unknown()).default({}),
    packages: z.record(z.string(), z.unknown()).default({}),
} satisfies SchemaShape<PnpmLockfile>) satisfies z.ZodType<PnpmLockfile>;

export const yarnLockSchema = z.record(z.string(), z.unknown());

export const yarnPackageSchema = z.looseObject({
    version: z.string().optional(),
    resolved: z.string().optional(),
} satisfies SchemaShape<YarnPackage>) satisfies z.ZodType<YarnPackage>;

export const uvLockSchema = z.looseObject({
    version: z.number().optional(),
    'requires-python': z.string().optional(),
    package: z
        .array(
            z.looseObject({
                name: z.string(),
                version: z.string().optional(),
                source: z.looseObject({ virtual: z.string().optional() }).optional(),
                metadata: z
                    .looseObject({
                        'requires-dist': z
                            .array(z.object({ name: z.string(), specifier: z.string().optional() }))
                            .optional(),
                    })
                    .optional(),
            }),
        )
        .default([]),
} satisfies SchemaShape<UvLockfile>) satisfies z.ZodType<UvLockfile>;
