// Reads exact npm package-manager names and versions.
import { z } from 'zod';
import semver from 'semver';
import type { SchemaShape } from '#cli/types/objects.ts';
import { NPM_CLIENTS, YARN_BERRY_MAJOR, NPM_CLIENT_HASH_SUFFIX } from '#cli/config/parsers/dependency-files.ts';

import type {
    NpmClient,
    PackageJson,
    NpmClientIdentity,
    NpmClientDeclaration,
} from '#cli/types/parsers/dependency-files.ts';

const exactVersionSchema = z
    .string()
    .refine(
        (value) => semver.valid(value) !== null,
        'Package manager version must be exact.',
    ) satisfies z.ZodType<string>;

function parsePackageManagerField(value: string): NpmClientDeclaration {
    const [name, declared, ...verbatim] = value.split('@');
    if (verbatim.length > 0) throw new Error('Invalid packageManager declaration.');
    const version = (declared ?? '').split(NPM_CLIENT_HASH_SUFFIX, 1)[0];
    return packageManagerDeclarationSchema.parse({ name, version });
}

export const npmClientIdentitySchema = z.strictObject({
    name: z.enum(NPM_CLIENTS),
    version: exactVersionSchema.optional(),
} satisfies SchemaShape<NpmClientIdentity>);

export const packageManagerSchema = npmClientIdentitySchema.required() satisfies z.ZodType<NpmClient>;

/** Authored manager names before installation validates their requested version. */
export const packageManagerDeclarationSchema = z.strictObject({
    name: z.enum(NPM_CLIENTS),
    version: z.string().optional(),
} satisfies SchemaShape<NpmClientDeclaration>);

/**
 * Identify the Yarn major version that uses Berry configuration and installation arguments.
 * @param installer the validated package manager and version requirement.
 * @returns whether the package manager uses Yarn Berry.
 */
export function isYarnBerry(installer: NpmClient): boolean {
    if (installer.name !== 'yarn') return false;
    return semver.major(installer.version) >= YARN_BERRY_MAJOR;
}

/**
 * Read a package-manager declaration before validating its installation version.
 * @param manifest the validated package manifest.
 * @returns packageManager first, then the first devEngines declaration, or no declaration.
 */
export function readPackageManagerDeclaration(manifest: PackageJson): NpmClientDeclaration | undefined {
    if (manifest.packageManager !== undefined) return parsePackageManagerField(manifest.packageManager);
    const engines = manifest.devEngines?.packageManager;
    const entry = Array.isArray(engines) ? engines[0] : engines;
    return entry?.name === undefined ? undefined : packageManagerDeclarationSchema.parse(entry);
}
