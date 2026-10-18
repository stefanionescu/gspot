// Read and select the repository package manager.
import { z } from 'zod';
import semver from 'semver';
import { join, dirname } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { VERSION_FLAG } from '#cli/config/tools/run.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import { detectPackageManager as detectNypmPackageManager } from 'nypm';
import { NPM_PROGRAM, NYPM_DETECTION_OPTIONS } from '#cli/config/tools/npm.ts';

import {
    type PackageJson,
    type PackageManager,
    type PackageManagerDeclaration,
} from '#cli/types/parsers/dependency-files.ts';
import {
    PACKAGE_JSON,
    PACKAGE_MANAGERS,
    YARN_BERRY_MAJOR,
    PACKAGE_MANAGER_HASH_SUFFIX,
} from '#cli/config/parsers/dependency-files.ts';

const exactVersionSchema = z
    .string()
    .refine(
        (value) => semver.valid(value) !== null,
        'Package manager version must be exact.',
    ) satisfies z.ZodType<string>;

/**
 * Split a packageManager field such as `npm@11.17.0+sha512.abc` into a name and a version.
 * @param value the text of the field in package.json.
 * @returns the name and the version, without the hash.
 */
function parsePackageManagerField(value: string): PackageManagerDeclaration {
    const [name, declared, ...verbatim] = value.split('@');
    if (verbatim.length > 0) throw new Error('Invalid packageManager declaration.');
    const version = (declared ?? '').split(PACKAGE_MANAGER_HASH_SUFFIX, 1)[0];
    return packageManagerDeclarationSchema.parse({ name, version });
}

// Read the package manager from repository declarations and lockfiles.
async function detectPackageManager(root: string, candidates: string[]): Promise<PackageManagerDeclaration> {
    for (const path of candidates) {
        const packageJson = readPackageJson(root, path);
        const declared = packageJson === undefined ? undefined : readPackageManagerDeclaration(packageJson);
        if (declared !== undefined) return declared;
        const detected = await detectNypmPackageManager(join(root, dirname(path)), NYPM_DETECTION_OPTIONS);
        if (detected !== undefined)
            return packageManagerDeclarationSchema.parse({ name: detected.name, version: detected.version });
    }
    return { name: NPM_PROGRAM, version: undefined };
}

/** The authored package manager declaration, before install validates its version. */
const packageManagerDeclarationSchema = z.strictObject({
    name: z.enum(PACKAGE_MANAGERS),
    version: z.string().optional(),
} satisfies SchemaShape<PackageManagerDeclaration>) satisfies z.ZodType<PackageManagerDeclaration>;

const packageManagerSchema = packageManagerDeclarationSchema.extend({
    version: exactVersionSchema,
}) satisfies z.ZodType<PackageManager>;

/**
 * Check whether the package manager runs Yarn Berry, which has its own settings and install arguments.
 * @param packageManager the validated name and version range.
 * @returns whether the package manager uses Yarn Berry.
 */
function isYarnBerry(packageManager: PackageManager): boolean {
    if (packageManager.name !== 'yarn') return false;
    return semver.major(packageManager.version) >= YARN_BERRY_MAJOR;
}

/**
 * Read the package manager declaration, before its version gets validated.
 * @param packageJson the validated package.json.
 * @returns packageManager first, then the first devEngines declaration, or no declaration.
 */
function readPackageManagerDeclaration(packageJson: PackageJson): PackageManagerDeclaration | undefined {
    if (packageJson.packageManager !== undefined) return parsePackageManagerField(packageJson.packageManager);
    const engines = packageJson.devEngines?.packageManager;
    const entry = Array.isArray(engines) ? engines[0] : engines;
    return entry?.name === undefined ? undefined : packageManagerDeclarationSchema.parse(entry);
}

/**
 * Select the repository package manager from its declaration and lockfiles.
 *
 * @param repositoryRoot the folder whose package declarations and lockfiles select the manager.
 * @param trackedPaths the source paths inventoried in the repository.
 *
 * @returns the manager name and its declared or detected version, when present.
 */
async function selectPackageManager(
    repositoryRoot: string,
    trackedPaths: string[],
): Promise<PackageManagerDeclaration> {
    // The root declaration wins. Without it, the first nested package.json gives one stable package manager for the tools.
    const candidates = [
        PACKAGE_JSON,
        ...trackedPaths
            .filter((path) => path.endsWith('/package.json') && !isInGspotFolder(path))
            .toSorted((left, right) => left.localeCompare(right))
            .slice(0, 1),
    ];
    const { name, version } = await detectPackageManager(repositoryRoot, candidates);
    if (version !== undefined) {
        if (semver.valid(version) === null)
            throw new GspotError(
                'installation',
                `The tool project needs an exact ${name} version, such as ${name}@1.2.3, and package.json declares ${version}. Write an exact packageManager version.`,
            );
        return { name, version };
    }
    return { name };
}

/**
 * Resolve an undeclared package manager version only when generating or installing a tool project.
 *
 * @param repositoryRoot the working folder used when querying an undeclared version.
 * @param packageManager the declared or detected name and version.
 * @param timeoutSeconds the limit for the version query.
 *
 * @returns the name and version requirement used by the tool project.
 */
function readPackageManagerVersion(
    repositoryRoot: string,
    packageManager: PackageManagerDeclaration,
    timeoutSeconds: number,
): PackageManager {
    const { name, version } = packageManager;
    if (version !== undefined) return { name, version };
    const result = spawnProcessBlocking([name, VERSION_FLAG], {
        cwd: repositoryRoot,
        timeoutSeconds: timeoutSeconds,
    });
    if (result.code !== 0) throw new GspotError('tool', `Cannot determine the ${name} version for the tool project.`);
    return packageManagerSchema.parse({ name, version: result.stdout.trim() });
}

export { isYarnBerry, selectPackageManager, readPackageManagerVersion };
