import semver from 'semver';
import * as nypm from 'nypm';
import { join, dirname } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { VERSION_FLAG } from '#cli/config/tools/versions.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import type { CacheKey, ReadCache } from '#cli/types/system/files.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import type { PackageJson } from '#cli/types/parsers/projects/dependencies.ts';
import { packageManagerSchema, packageManagerPinSchema } from '#cli/schemas/repository/npm.ts';

import type {
    StartRunner,
    PackageManager,
    PackageManagerPin,
    PackageManagerField,
} from '#cli/types/repository/npm/package-manager.ts';
import {
    NPM_TOOL,
    START_RUNNERS,
    PACKAGE_MANAGERS,
    YARN_BERRY_MAJOR,
    NYPM_DETECTION_OPTIONS,
    PACKAGE_MANAGER_HASH_SUFFIX,
    MISSING_PACKAGE_MANAGER_MESSAGE,
} from '#cli/config/repository/npm.ts';

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

function buildPackageManagerField(
    pin: { name: string | undefined; version: string | undefined },
    field: string,
    written: string,
): PackageManagerField {
    const parsed = packageManagerPinSchema.safeParse(pin);
    if (!parsed.success)
        throw new GspotError(
            'install',
            `package.json: ${field} is "${written}"; gspot supports ${PACKAGE_MANAGERS.join(', ')} with an exact version, such as pnpm@9.0.0. Change the field.`,
        );
    return { ...parsed.data, written, field };
}

function parsePackageManagerField(field: string): PackageManagerField {
    const [name, requested, ...verbatim] = field.split('@');
    const version = (requested ?? '').split(PACKAGE_MANAGER_HASH_SUFFIX, 1)[0];
    return buildPackageManagerField(
        { name: verbatim.length === 0 ? name : undefined, version },
        'packageManager',
        field,
    );
}

async function readFirstPackageManager(
    root: string,
    packageJsonPaths: string[],
): Promise<PackageManagerField | { name: PackageManagerPin['name']; version?: undefined }> {
    for (const path of packageJsonPaths) {
        const packageJson = readPackageJson(root, path);
        const pin = packageJson === undefined ? undefined : readPackageManagerPin(packageJson);
        if (pin !== undefined) return pin;
        const detected = await nypm.detectPackageManager(join(root, dirname(path)), NYPM_DETECTION_OPTIONS);
        const name = PACKAGE_MANAGERS.find((tool) => tool === detected?.name);
        if (name !== undefined) return { name };
    }
    return { name: NPM_TOOL, version: undefined };
}

/**
 * Check whether the package manager runs Yarn Berry, which has its own settings and install arguments.
 *
 * @param packageManager the validated name and exact version.
 * @returns whether the package manager uses Yarn Berry.
 */
export function isYarnBerry(packageManager: PackageManager): boolean {
    if (packageManager.name !== 'yarn') return false;
    return semver.major(packageManager.version) >= YARN_BERRY_MAJOR;
}

function readPackageManagerPin(packageJson: PackageJson): PackageManagerField | undefined {
    if (packageJson.packageManager !== undefined) return parsePackageManagerField(packageJson.packageManager);
    const engines = packageJson.devEngines?.packageManager;
    const engine = Array.isArray(engines) ? engines[0] : engines;
    return engine?.name === undefined
        ? undefined
        : buildPackageManagerField(
              { name: engine.name, version: engine.version },
              'devEngines.packageManager',
              engine.version ?? engine.name,
          );
}

/**
 * Select the repository package manager from its pin and lockfiles.
 *
 * @param repositoryRoot the folder whose package.json files and lockfiles select the manager.
 * @param trackedPaths the source paths inventoried in the repository.
 * @returns the manager name and its declared or detected version, when present.
 */
export async function detectPackageManager(repositoryRoot: string, trackedPaths: string[]): Promise<PackageManagerPin> {
    const packageJsonPaths = [
        PACKAGE_JSON,
        ...trackedPaths
            .filter((path) => path.endsWith(`/${PACKAGE_JSON}`) && !path.startsWith(`${DOT_GSPOT}/`))
            .toSorted((left, right) => compareText(left, right)),
    ];
    const selected = await readFirstPackageManager(repositoryRoot, packageJsonPaths);
    if (selected.version !== undefined) {
        const { name, version, written, field } = selected;
        if (semver.valid(version) === null)
            throw new GspotError(
                'install',
                `The tool project needs an exact ${name} version, such as ${name}@1.2.3; package.json declares "${written}" in ${field}. Write an exact version there.`,
            );
        return { name, version };
    }
    return { name: selected.name };
}

/**
 * Resolve an undeclared package manager version only when generating or installing a tool project.
 *
 * @param repositoryRoot the working folder for the query of an undeclared version.
 * @param packageManager the declared or detected name and version.
 * @param timeoutSeconds the limit for the version query.
 * @param reads the run cache that owns the resolved version.
 * @returns the name and version requirement that the tool project uses.
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
