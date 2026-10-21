// Read and select the repository package manager.
import semver from 'semver';
import { join, dirname } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { VERSION_FLAG } from '#cli/config/tools/run.ts';
import { RUNNERS } from '#cli/config/generation/hooks.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { StartRunner } from '#cli/types/generation/files.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import { detectPackageManager as detectNypmPackageManager } from 'nypm';
import { type MemoKey, type ReadCache } from '#cli/types/system/files.ts';
import type { PackageManagerField } from '#cli/types/repository/package-manager.ts';
import { NPM_PROGRAM, NYPM_DETECTION_OPTIONS, MISSING_PACKAGE_MANAGER_MESSAGE } from '#cli/config/tools/npm.ts';
import { PACKAGE_JSON, YARN_BERRY_MAJOR, PACKAGE_MANAGER_HASH_SUFFIX } from '#cli/config/parsers/dependencies.ts';
import { packageManagerSchema, packageManagerDeclarationSchema } from '#cli/schemas/repository/package-manager.ts';

import {
    type PackageJson,
    type PackageManager,
    type PackageManagerDeclaration,
} from '#cli/types/parsers/dependencies.ts';

const packageManagerVersions: MemoKey<Map<string, PackageManager>> = { create: () => new Map() };

/**
 * Refuse a tool-project operation when the session selects no package manager.
 *
 * @param declaration the package manager selected by the session.
 * @returns the declared or detected package manager.
 * @throws when the session has no package manager for a tool project.
 */
function assertPackageManager(declaration: PackageManagerDeclaration | undefined): PackageManagerDeclaration {
    if (declaration === undefined) throw new GspotError('installation', MISSING_PACKAGE_MANAGER_MESSAGE);
    return declaration;
}

/**
 * Split a packageManager field such as `npm@11.17.0+sha512.abc` into a name and a version.
 *
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
async function detectPackageManager(
    root: string,
    candidates: string[],
): Promise<PackageManagerField | { name: PackageManagerDeclaration['name']; version?: undefined }> {
    for (const path of candidates) {
        const packageJson = readPackageJson(root, path);
        const declared = packageJson === undefined ? undefined : readPackageManagerDeclaration(packageJson);
        if (declared !== undefined) return declared;
        const detected = await detectNypmPackageManager(join(root, dirname(path)), NYPM_DETECTION_OPTIONS);
        if (detected !== undefined)
            return { name: packageManagerDeclarationSchema.parse({ name: detected.name }).name };
    }
    return { name: NPM_PROGRAM, version: undefined };
}

/**
 * Check whether the package manager runs Yarn Berry, which has its own settings and install arguments.
 *
 * @param packageManager the validated name and version range.
 * @returns whether the package manager uses Yarn Berry.
 */
function isYarnBerry(packageManager: PackageManager): boolean {
    if (packageManager.name !== 'yarn') return false;
    return semver.major(packageManager.version) >= YARN_BERRY_MAJOR;
}

/**
 * Read the package manager declaration, before its version gets validated.
 *
 * @param packageJson the validated package.json.
 * @returns the declaration with its raw text and field, or no declaration.
 */
function readPackageManagerDeclaration(packageJson: PackageJson): PackageManagerField | undefined {
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
              ...packageManagerDeclarationSchema.parse(entry),
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
async function selectPackageManager(
    repositoryRoot: string,
    trackedPaths: string[],
): Promise<PackageManagerDeclaration> {
    // The root declaration wins. Without it, the first nested package.json gives one stable package manager for the tools.
    const candidates = [
        PACKAGE_JSON,
        ...trackedPaths
            .filter((path) => path.endsWith(`/${PACKAGE_JSON}`) && !isInGspotFolder(path))
            .toSorted((left, right) => left.localeCompare(right))
            .slice(0, 1),
    ];
    const selected = await detectPackageManager(repositoryRoot, candidates);
    if (selected.version !== undefined) {
        const { name, version, declared, field } = selected;
        if (semver.valid(version) === null)
            throw new GspotError(
                'installation',
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
function readPackageManagerVersion(
    repositoryRoot: string,
    packageManager: PackageManagerDeclaration,
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
async function selectRunner(repositoryRoot: string): Promise<StartRunner> {
    const packageJson = readPackageJson(repositoryRoot, PACKAGE_JSON);
    const hasDependency =
        packageJson?.dependencies?.[packageManifest.name] !== undefined ||
        packageJson?.devDependencies?.[packageManifest.name] !== undefined;
    const packageManager = hasDependency ? await selectPackageManager(repositoryRoot, []) : undefined;
    const name = packageManager === undefined ? 'mise' : packageManager.name;
    const runner = RUNNERS[name];
    return { name, ...runner, pin: runner.pin.replace('<package>', packageManifest.name) };
}

export { isYarnBerry, selectRunner, assertPackageManager, selectPackageManager, readPackageManagerVersion };
