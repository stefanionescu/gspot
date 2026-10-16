// Reads and selects the repository package manager.
import { z } from 'zod';
import semver from 'semver';
import { join, dirname } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { VERSION_FLAG } from '#cli/config/tools/run.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import { detectPackageManager as detectNypmPackageManager } from 'nypm';
import { NPM_PROGRAM, NPM_CLIENT_DETECTION } from '#cli/config/tools/npm.ts';

import {
    type PackageJson,
    type PackageManager,
    type PackageManagerDeclaration,
} from '#cli/types/parsers/dependency-files.ts';
import {
    NPM_CLIENTS,
    PACKAGE_JSON,
    YARN_BERRY_MAJOR,
    NPM_CLIENT_HASH_SUFFIX,
} from '#cli/config/parsers/dependency-files.ts';

const exactVersionSchema = z
    .string()
    .refine(
        (value) => semver.valid(value) !== null,
        'Package manager version must be exact.',
    ) satisfies z.ZodType<string>;

function parsePackageManagerField(value: string): PackageManagerDeclaration {
    const [name, declared, ...verbatim] = value.split('@');
    if (verbatim.length > 0) throw new Error('Invalid packageManager declaration.');
    const version = (declared ?? '').split(NPM_CLIENT_HASH_SUFFIX, 1)[0];
    return packageManagerDeclarationSchema.parse({ name, version });
}

// Read the package manager from repository declarations and lockfiles.
async function detectPackageManager(root: string, candidates: string[]) {
    for (const path of candidates) {
        const manifest = readPackageJson(root, path);
        const declared = manifest === undefined ? undefined : readPackageManagerDeclaration(manifest);
        if (declared !== undefined) return declared;
        const detected = await detectNypmPackageManager(join(root, dirname(path)), NPM_CLIENT_DETECTION);
        if (detected !== undefined)
            return packageManagerDeclarationSchema.parse({ name: detected.name, version: detected.version });
    }
    return { name: NPM_PROGRAM, version: undefined };
}

const npmClientIdentitySchema = z.strictObject({
    name: z.enum(NPM_CLIENTS),
    version: exactVersionSchema.optional(),
} satisfies SchemaShape<PackageManagerDeclaration>);

const packageManagerSchema = npmClientIdentitySchema.required() satisfies z.ZodType<PackageManager>;

/** Authored manager names before installation validates their requested version. */
const packageManagerDeclarationSchema = z.strictObject({
    name: z.enum(NPM_CLIENTS),
    version: z.string().optional(),
} satisfies SchemaShape<PackageManagerDeclaration>);

/**
 * Identify the Yarn major version that uses Berry configuration and installation arguments.
 * @param packageManager the validated package manager and version requirement.
 * @returns whether the package manager uses Yarn Berry.
 */
function isYarnBerry(packageManager: PackageManager): boolean {
    if (packageManager.name !== 'yarn') return false;
    return semver.major(packageManager.version) >= YARN_BERRY_MAJOR;
}

/**
 * Read a package-manager declaration before validating its installation version.
 * @param manifest the validated package manifest.
 * @returns packageManager first, then the first devEngines declaration, or no declaration.
 */
function readPackageManagerDeclaration(manifest: PackageJson): PackageManagerDeclaration | undefined {
    if (manifest.packageManager !== undefined) return parsePackageManagerField(manifest.packageManager);
    const engines = manifest.devEngines?.packageManager;
    const entry = Array.isArray(engines) ? engines[0] : engines;
    return entry?.name === undefined ? undefined : packageManagerDeclarationSchema.parse(entry);
}

/**
 * Select the repository package manager from its declaration and lockfiles.
 *
 * @param root the repository root.
 * @param trackedPaths the source paths inventoried in the repository.
 *
 * @returns the manager name and its declared or detected version, when present.
 */
async function selectPackageManager(root: string, trackedPaths: string[]): Promise<PackageManagerDeclaration> {
    // The root declaration wins; without it, the first nested manifest provides a deterministic shared tool manager.
    const candidates = [
        PACKAGE_JSON,
        ...trackedPaths
            .filter((path) => path.endsWith('/package.json') && !isInGspotFolder(path))
            .toSorted((left, right) => left.localeCompare(right))
            .slice(0, 1),
    ];
    const { name, version } = await detectPackageManager(root, candidates);
    if (version !== undefined) {
        if (semver.valid(version) === null)
            throw new GspotError(
                'installation',
                `The tool project needs an exact ${name} version, such as ${name}@1.2.3, and package.json declares ${version}. Write an exact packageManager version.`,
            );
        return packageManagerSchema.parse({ name, version });
    }
    return npmClientIdentitySchema.parse({ name });
}

/**
 * Resolve an undeclared package manager version only when generating or installing a tool project.
 *
 * @param root the repository root.
 * @param packageManager the declared or detected package manager identity.
 * @param timeoutSeconds the tool timeout in seconds.
 *
 * @returns the name and version requirement used by the tool project.
 */
function readPackageManagerVersion(
    root: string,
    packageManager: PackageManagerDeclaration,
    timeoutSeconds: number,
): PackageManager {
    const { name, version } = packageManager;
    if (version !== undefined) return { name, version };
    const result = spawnProcessBlocking([name, VERSION_FLAG], {
        cwd: root,
        timeoutSeconds: timeoutSeconds,
    });
    if (result.code !== 0) throw new GspotError('tool', `Cannot determine the ${name} version for the tool project.`);
    return packageManagerSchema.parse({ name, version: result.stdout.trim() });
}

export { isYarnBerry, selectPackageManager, readPackageManagerVersion };
