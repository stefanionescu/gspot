import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';

import {
    type UvLockfile,
    type BunLockfile,
    type NpmLockfile,
    type YarnPackage,
    type PnpmLockfile,
    type DependencySections,
} from '#cli/types/parsers/projects/lockfiles.ts';

export const dependencySectionsSchema = z.looseObject({
    peerDependencies: z.record(z.string(), z.unknown()).optional(),
    dependencies: z.record(z.string(), z.unknown()).optional(),
    devDependencies: z.record(z.string(), z.unknown()).optional(),
    optionalDependencies: z.record(z.string(), z.unknown()).optional(),
} satisfies SchemaShape<DependencySections>);

const npmPackageSchema = z.looseObject({
    version: z.string().optional(),
} satisfies SchemaShape<NpmLockfile['packages'][string]>);

export const npmLockfileSchema = z.looseObject({
    packages: z.record(z.string(), npmPackageSchema).default({}),
} satisfies SchemaShape<NpmLockfile>);

export const bunLockfileSchema = z.looseObject({
    workspaces: z.record(z.string(), z.unknown()).default({}),
    packages: z.record(z.string(), z.unknown().array()).default({}),
} satisfies SchemaShape<BunLockfile>);

export const pnpmLockfileSchema = z.looseObject({
    importers: z.record(z.string(), z.unknown()).default({}),
    packages: z.record(z.string(), z.unknown()).default({}),
} satisfies SchemaShape<PnpmLockfile>);

export const yarnLockfileSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;

export const yarnPackageSchema = z.looseObject({
    version: z.string().optional(),
    resolved: z.string().optional(),
} satisfies SchemaShape<YarnPackage>);

const uvSourceSchema = z.looseObject({
    virtual: z.string().optional(),
} satisfies SchemaShape<NonNullable<UvLockfile['package'][number]['source']>>);

const uvRequirementSchema = z.object({
    name: z.string(),
    specifier: z.string().optional(),
} satisfies SchemaShape<NonNullable<NonNullable<UvLockfile['package'][number]['metadata']>['requires-dist']>[number]>);

const uvMetadataSchema = z.looseObject({
    'requires-dist': uvRequirementSchema.array().optional(),
} satisfies SchemaShape<NonNullable<UvLockfile['package'][number]['metadata']>>);

export const uvLockfileSchema = z.looseObject({
    options: z
        .object({ 'exclude-newer-span': z.string().optional() } satisfies SchemaShape<
            NonNullable<UvLockfile['options']>
        >)
        .optional(),
    version: z.number().optional(),
    'requires-python': z.string().optional(),
    package: z
        .looseObject({
            name: z.string(),
            version: z.string().optional(),
            source: uvSourceSchema.optional(),
            metadata: uvMetadataSchema.optional(),
        } satisfies SchemaShape<UvLockfile['package'][number]>)
        .array()
        .default([]),
} satisfies SchemaShape<UvLockfile>);
