import semver from 'semver';
import * as nypm from 'nypm';
import { join, dirname } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import { VERSION_FLAG } from '#cli/config/tools/run.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import type { PackageJson } from '#cli/types/parsers/dependencies.ts';
import type { CacheKey, ReadCache } from '#cli/types/system/files.ts';
import { MISSING_PACKAGE_MANAGER_MESSAGE } from '#cli/config/install/npm.ts';
import { packageManagerSchema, packageManagerPinSchema } from '#cli/schemas/repository/package-manager.ts';

import type {
    StartRunner,
    PackageManager,
    PackageManagerPin,
    PackageManagerField,
} from '#cli/types/repository/package-manager.ts';
import {
    NPM_TOOL,
    START_RUNNERS,
    YARN_BERRY_MAJOR,
    NYPM_DETECTION_OPTIONS,
    PACKAGE_MANAGER_HASH_SUFFIX,
} from '#cli/config/repository/package-manager.ts';

const packageManagerVersions: CacheKey<Map<string, PackageManager>> = { create: () => new Map() };

/**
 * Refuse a tool-project operation when the session selects no package manager.
 *
 * @param pin the package manager selected by the session.
 * @returns the declared or detected package manager.
 * @throws when the session has no package manager for a tool project.
 */
export function assertPackageManager(pin: PackageManagerPin | undefined): PackageManagerPin {
    if (pin === undefined) throw new GspotError('install', MISSING_PACKAGE_MANAGER_MESSAGE);
    return pin;
}

/**
 * Split a packageManager field such as `npm@11.17.0+sha512.abc` into a name and a version.
 *
 * @param field the text of the field in package.json.
 * @returns the name and the version, without the hash.
 */
function parsePackageManagerField(field: string): PackageManagerPin {
    const [name, declared, ...verbatim] = field.split('@');
    if (verbatim.length > 0) throw new Error('Invalid packageManager declaration.');
    const version = (declared ?? '').split(PACKAGE_MANAGER_HASH_SUFFIX, 1)[0];
    return packageManagerPinSchema.parse({ name, version });
}

// Read the package manager from repository declarations and lockfiles.
async function readFirstPackageManager(
    root: string,
    packageJsonPaths: string[],
): Promise<PackageManagerField | { name: PackageManagerPin['name']; version?: undefined }> {
    for (const path of packageJsonPaths) {
        const packageJson = readPackageJson(root, path);
        const declared = packageJson === undefined ? undefined : readPackageManagerPin(packageJson);
        if (declared !== undefined) return declared;
        const detected = await nypm.detectPackageManager(join(root, dirname(path)), NYPM_DETECTION_OPTIONS);
        if (detected !== undefined) return { name: packageManagerPinSchema.parse({ name: detected.name }).name };
    }
    return { name: NPM_TOOL, version: undefined };
}

/**
 * Check whether the package manager runs Yarn Berry, which has its own settings and install arguments.
 *
 * @param packageManager the validated name and version range.
 * @returns whether the package manager uses Yarn Berry.
 */
export function isYarnBerry(packageManager: PackageManager): boolean {
    if (packageManager.name !== 'yarn') return false;
    return semver.major(packageManager.version) >= YARN_BERRY_MAJOR;
}

/**
 * Read the package manager declaration, before its version gets validated.
 *
 * @param packageJson the validated package.json.
 * @returns the declaration with its raw text and field, or no declaration.
 */
function readPackageManagerPin(packageJson: PackageJson): PackageManagerField | undefined {
    if (packageJson.packageManager !== undefined)
        return {
            ...parsePackageManagerField(packageJson.packageManager),
            declared: packageJson.packageManager,
            field: 'packageManager',
        };
    const engines = packageJson.devEngines?.packageManager;
    const entry = Array.isArray(engines) ? engines[0] : engines;
    return entry?.name === undefined
        ? undefined
        : {
              ...packageManagerPinSchema.parse(entry),
              declared: entry.version ?? entry.name,
              field: 'devEngines.packageManager',
          };
}

/**
 * Select the repository package manager from its declaration and lockfiles.
 *
 * @param repositoryRoot the folder whose package declarations and lockfiles select the manager.
 * @param trackedPaths the source paths inventoried in the repository.
 *
 * @returns the manager name and its declared or detected version, when present.
 */
export async function detectPackageManager(repositoryRoot: string, trackedPaths: string[]): Promise<PackageManagerPin> {
    // The root declaration wins. Without it, the first nested package.json gives one stable package manager for the tools.
    const packageJsonPaths = [
        PACKAGE_JSON,
        ...trackedPaths
            .filter((path) => path.endsWith(`/${PACKAGE_JSON}`) && !path.startsWith(`${DOT_GSPOT}/`))
            .toSorted((left, right) => left.localeCompare(right))
            .slice(0, 1),
    ];
    const selected = await readFirstPackageManager(repositoryRoot, packageJsonPaths);
    if (selected.version !== undefined) {
        const { name, version, declared, field } = selected;
        if (semver.valid(version) === null)
            throw new GspotError(
                'install',
                `The tool project needs an exact ${name} version, such as ${name}@1.2.3; package.json declares "${declared}" in ${field}. Write an exact version there.`,
            );
        return { name, version };
    }
    return { name: selected.name };
}

/**
 * Resolve an undeclared package manager version only when generating or installing a tool project.
 *
 * @param repositoryRoot the working folder used when querying an undeclared version.
 * @param packageManager the declared or detected name and version.
 * @param timeoutSeconds the limit for the version query.
 * @param reads the run cache that owns the resolved version.
 *
 * @returns the name and version requirement used by the tool project.
 */
export function readPackageManagerVersion(
    repositoryRoot: string,
    packageManager: PackageManagerPin,
    timeoutSeconds: number,
    reads: ReadCache,
): PackageManager {
    const key = JSON.stringify([repositoryRoot, packageManager.name, packageManager.version]);
    return getCachedMapValue(reads, packageManagerVersions, key, () => {
        const { name, version } = packageManager;
        if (version !== undefined) return { name, version };
        const result = spawnProcessBlocking([name, VERSION_FLAG], {
            cwd: repositoryRoot,
            timeoutSeconds,
        });
        if (result.code !== 0)
            throw new GspotError('tool', `Cannot determine the ${name} version for the tool project.`);
        return packageManagerSchema.parse({ name, version: result.stdout.trim() });
    });
}

/**
 * Select the runner from the root gspot dependency.
 *
 * @param repositoryRoot the folder whose package.json decides the runner.
 *
 * @returns the runner of the package manager, or mise when gspot has no root npm dependency.
 */
export async function selectStartRunner(repositoryRoot: string): Promise<StartRunner> {
    const packageJson = readPackageJson(repositoryRoot, PACKAGE_JSON);
    const hasDependency =
        packageJson?.dependencies?.[cliPackage.name] !== undefined ||
        packageJson?.devDependencies?.[cliPackage.name] !== undefined;
    const packageManager = hasDependency ? await detectPackageManager(repositoryRoot, []) : undefined;
    const name = packageManager === undefined ? 'mise' : packageManager.name;
    const runner = START_RUNNERS[name];
    return { name, ...runner, installCommand: runner.installCommand.replace('<package>', cliPackage.name) };
}
