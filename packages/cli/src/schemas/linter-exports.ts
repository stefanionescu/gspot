import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { type PackageIdentity, type TestsPackageJson } from '#cli/types/linter-exports.ts';

export const packageIdentitySchema = z.object({
    name: z.string(),
    version: z.string(),
    peerDependencies: z.record(z.string(), z.string()).default({}),
} satisfies SchemaShape<PackageIdentity>);

export const testsPackageJsonSchema = z.object({
    devDependencies: z.record(z.string(), z.string()),
} satisfies SchemaShape<TestsPackageJson>);
