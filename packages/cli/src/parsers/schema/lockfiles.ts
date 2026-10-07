// Shapes read from dependency lockfiles before their values reach consumers.
import { z } from 'zod';
import { LOCKFILE_VERSIONS } from '#cli/config/parsers/lockfiles.ts';

const devDependenciesSchema = z.object({ devDependencies: z.record(z.string(), z.string()).optional() });
const packageIdentitySchema = z.object({ name: z.string().min(1), version: z.string().min(1) });
const packageVersionSchema = z.object({ version: z.string().optional(), name: z.string().optional() });

export const npmLockfileSchema = z.object({ packages: z.record(z.string(), devDependenciesSchema) });
export const bunLockfileSchema = z.object({ workspaces: z.record(z.string(), devDependenciesSchema) });
export const pnpmLockfileSchema = z.object({
    importers: z.record(z.string(), z.object({ devDependencies: z.unknown() })),
});
export const pnpmSpecifiersSchema = z.record(z.string(), z.object({ specifier: z.string() }));
export const yarnLockfileSchema = z.record(
    z.string(),
    z.looseObject({ version: z.string().optional(), resolved: z.string().optional() }),
);
export const bunPackagesSchema = z.looseObject({ packages: z.record(z.string(), z.array(z.unknown())) });
export const bunPackageSchema = z.tuple([z.string(), z.string(), z.record(z.string(), z.unknown()), z.string()]);

export const pythonLockfileSchema = z.object({ package: z.array(packageIdentitySchema) });
export const npmDependenciesSchema = z.object({ dependencies: z.record(z.string(), z.unknown()) });
export const npmDependencySchema = z.object({
    version: z.string(),
    dependencies: z.record(z.string(), z.unknown()).optional(),
});
export const npmVersionSchema = z.object({ lockfileVersion: z.number() });
export const npmPackagesSchema = z.object({
    lockfileVersion: z.literal(LOCKFILE_VERSIONS),
    packages: z.record(z.string(), packageVersionSchema),
});
export const bunIdentitiesSchema = z.object({
    packages: z.record(z.string(), z.tuple([z.string()]).rest(z.unknown())),
});
export const pnpmPackagesSchema = z.object({ packages: z.record(z.string(), z.unknown()) });
export const yarnRecordsSchema = z.record(z.string(), z.unknown());
export const yarnPackagesSchema = z.record(
    z.string(),
    packageVersionSchema.extend({ resolution: z.string().optional() }),
);
