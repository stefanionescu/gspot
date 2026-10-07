// Shapes read from dependency lockfiles before their values reach consumers.
import { z } from 'zod';

const devDependenciesSchema = z.object({ devDependencies: z.record(z.string(), z.string()).optional() });

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
