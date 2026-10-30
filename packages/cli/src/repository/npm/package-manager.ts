import semver from 'semver';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { remember } from '#cli/system/files/cache.ts';
import { CI_NODE } from '#cli/config/generation/ci.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { ReadCache } from '#cli/types/system/files.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { VERSION_FLAG } from '#cli/config/executables/versions.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import type { PackageJson } from '#cli/types/parsers/projects/dependencies.ts';
import { packageManagerSchema, packageManagerPinSchema } from '#cli/schemas/repository/npm.ts';

import {
    NPM_TOOL,
    START_RUNNERS,
    PACKAGE_MANAGERS,
    YARN_BERRY_MAJOR,
    PACKAGE_MANAGER_HASH_SUFFIX,
} from '#cli/config/repository/npm.ts';
import type {
    StartRunner,
    PackageManager,
    PackageManagerPin,
    PackageManagerField,
    PackageManagerCommand,
} from '#cli/types/repository/npm/package-manager.ts';

const PACKAGE_MANAGER_VERSIONS = Symbol('package manager versions');

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
    const [name, requested = '', ...verbatim] = field.split('@');
    const version = requested.split(PACKAGE_MANAGER_HASH_SUFFIX, 1)[0];
    return buildPackageManagerField(
        { name: verbatim.length === 0 ? name : undefined, version },
        'packageManager',
        field,
    );
}

function readFirstPackageManager(
    root: string,
    packageJsonPaths: string[],
): PackageManagerField | { name: PackageManagerPin['name']; version?: undefined } {
    for (const path of packageJsonPaths) {
        const packageJson = readPackageJson(root, path);
        const pin = packageJson === undefined ? undefined : getPackageManagerPin(packageJson);
        if (pin !== undefined) return pin;
        const lockfile = LOCKFILES.filter((row) => 'configuration' in row && row.configuration === 'javascript').find(
            ({ file }) => existsSync(join(root, dirname(path), file)),
        );
        const name = lockfile?.packageManager;
        if (name !== undefined) return { name };
    }
    return { name: NPM_TOOL, version: undefined };
}

/**
Check whether the package manager runs Yarn Berry, which has its own settings and install arguments.

@param packageManager the validated name and exact version.
@returns whether the package manager uses Yarn Berry.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CI generation and the tool package manager tell Yarn Berry apart by its major version through it.
export function isYarnBerry(packageManager: PackageManager): boolean {
    return packageManager.name === 'yarn' && semver.major(packageManager.version) >= YARN_BERRY_MAJOR;
}

/**
Read and validate the package manager pin written in package.json.

@param packageJson the repository package fields.
*/
export function getPackageManagerPin(packageJson: PackageJson): PackageManagerField | undefined {
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
Select the repository package manager from its pin and lockfiles.

@param root the folder whose package.json files and lockfiles select the manager.
@param trackedPaths the source paths inventoried in the repository.
@returns the manager name and its declared or detected version, when present.
*/
export function detectPackageManager(root: string, trackedPaths: string[]): PackageManagerPin {
    const packageJsonPaths = [
        PACKAGE_JSON,
        ...trackedPaths
            .filter((path) => path.endsWith(`/${PACKAGE_JSON}`) && !path.startsWith(`${GSPOT_FOLDER}/`))
            .toSorted((left, right) => compareText(left, right)),
    ];
    const selected = readFirstPackageManager(root, packageJsonPaths);
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
Resolve an undeclared package manager version only when generating or installing a tool project.

@param root the working folder for the query of an undeclared version.
@param packageManager the declared or detected name and version.
@param timeoutSeconds the limit for the version query.
@param reads the run cache that owns the resolved version.
*/
export function readPackageManagerVersion(
    root: string,
    packageManager: PackageManagerPin,
    timeoutSeconds: number,
    reads: ReadCache,
): PackageManager {
    const key = JSON.stringify([root, packageManager.name, packageManager.version]);
    return remember(reads, PACKAGE_MANAGER_VERSIONS, key, (): PackageManager => {
        const { name, version } = packageManager;
        if (version !== undefined) return { name, version };
        const result = spawnProcessBlocking([name, VERSION_FLAG], {
            cwd: root,
            timeoutSeconds,
        });
        if (result.code !== 0)
            throw new GspotError('tool', `Cannot determine the ${name} version for the tool project.`);
        const parsed = packageManagerSchema.safeParse({ name, version: result.stdout.trim() });
        if (!parsed.success)
            throw new GspotError(
                'tool',
                `Cannot read the ${name} version for the tool project. Check that ${name} --version prints a version.`,
                { cause: parsed.error },
            );
        return parsed.data;
    });
}

/**
Resolve a package manager for the tool project, using npm when the repository pins Yarn.

@param root the folder for a version query.
@param packageManager the repository package manager pin.
@param timeoutSeconds the version query limit.
@param reads the run cache for resolved versions.
@returns a package manager that can hold back new tool releases.
*/
export function readToolPackageManager(
    root: string,
    packageManager: PackageManagerPin,
    timeoutSeconds: number,
    reads: ReadCache,
): PackageManager & { name: Exclude<PackageManager['name'], 'yarn'> } {
    const name = packageManager.name === 'yarn' ? NPM_TOOL : packageManager.name;
    const selected = name === packageManager.name ? packageManager : { name };
    return { ...readPackageManagerVersion(root, selected, timeoutSeconds, reads), name };
}

/**
Select the runner from the root gspot dependency.

@param root the folder whose package.json decides the runner.
@returns the runner of the package manager, or mise when gspot has no root npm dependency.
*/
export function selectStartRunner(root: string): StartRunner {
    const packageJson = readPackageJson(root, PACKAGE_JSON);
    const hasDependency =
        packageJson?.dependencies?.[cliPackage.name] !== undefined ||
        packageJson?.devDependencies?.[cliPackage.name] !== undefined;
    const packageManager = hasDependency ? detectPackageManager(root, []) : undefined;
    const name = packageManager === undefined ? 'mise' : packageManager.name;
    const runner = START_RUNNERS[name];
    return { name, ...runner, installCommand: runner.installCommand.replace('<package>', () => cliPackage.name) };
}

/**
Run a declared package manager with its pinned runtime and version.

@param packageManager the manager name and declared version, if any.
@param commandArguments the executable options and operands to pass after its name.
@returns the direct command or the mise command for the exact pin.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CI generation and the npm installer run a package manager at its version through mise by this one rule.
export function buildPackageManagerCommand(
    packageManager: PackageManagerCommand,
    commandArguments: readonly string[],
): string[] {
    const command = [packageManager.name, ...commandArguments];
    return packageManager.version === undefined
        ? command
        : ['mise', 'exec', CI_NODE, `${packageManager.name}@${packageManager.version}`, '--', ...command];
}
