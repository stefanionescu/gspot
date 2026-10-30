import { z } from 'zod';

export const dependencySectionsSchema = z.looseObject({
    peerDependencies: z.record(z.string(), z.unknown()).optional(),
    dependencies: z.record(z.string(), z.unknown()).optional(),
    devDependencies: z.record(z.string(), z.unknown()).optional(),
    optionalDependencies: z.record(z.string(), z.unknown()).optional(),
});

const npmPackageSchema = z.looseObject({
    version: z.string().optional(),
});

export const npmLockfileSchema = z.looseObject({
    packages: z.record(z.string(), npmPackageSchema).default({}),
});

export const bunLockfileSchema = z.looseObject({
    workspaces: z.record(z.string(), z.unknown()).default({}),
    packages: z.record(z.string(), z.unknown().array()).default({}),
});

export const pnpmLockfileSchema = z.looseObject({
    importers: z.record(z.string(), z.unknown()).default({}),
    packages: z.record(z.string(), z.unknown()).default({}),
});

export const yarnLockfileSchema = z.record(z.string(), z.unknown());

export const yarnPackageSchema = z.looseObject({
    version: z.string().optional(),
    resolved: z.string().optional(),
});

const uvSourceSchema = z.looseObject({
    virtual: z.string().optional(),
});

const uvRequirementSchema = z.object({
    name: z.string(),
    specifier: z.string().optional(),
});

const uvMetadataSchema = z.looseObject({
    'requires-dist': uvRequirementSchema.array().optional(),
});

export const uvLockfileSchema = z.looseObject({
    options: z.object({ 'exclude-newer-span': z.string().optional() }).optional(),
    version: z.number().optional(),
    'requires-python': z.string().optional(),
    package: z
        .looseObject({
            name: z.string(),
            version: z.string().optional(),
            source: uvSourceSchema.optional(),
            metadata: uvMetadataSchema.optional(),
        })
        .array()
        .default([]),
});
