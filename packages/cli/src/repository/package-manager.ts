import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import semver from 'semver';

import { LOCKFILES, PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import {
    FROZEN_INSTALLS,
    NPM_TOOL,
    PACKAGE_MANAGER_HASH_SUFFIX,
    PACKAGE_MANAGERS,
    VERSION_FLAG,
    YARN_BERRY_INSTALL,
    YARN_BERRY_MAJOR,
} from '#cli/config/repository/package-managers.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { packageManagerPinSchema, packageManagerSchema } from '#cli/schemas/repository.ts';
import { remember } from '#cli/system/cache.ts';
import { GspotError, tryParseFile } from '#cli/system/errors.ts';
import { runProcess } from '#cli/system/processes.ts';
import { compareText } from '#cli/system/text.ts';
import type { PackageJson } from '#cli/types/parsers.ts';
import type {
    PackageManager,
    PackageManagerCommand,
    PackageManagerField,
    PackageManagerPin,
    ToolPackageManagerName,
} from '#cli/types/repository.ts';
import type { RunCache } from '#cli/types/system.ts';

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
        const packageJson = tryParseFile(() => readPackageJson(root, path));
        const pin = packageJson === undefined ? undefined : findPackageManagerPin(packageJson);
        if (pin !== undefined) return pin;
        const lockfile = LOCKFILES.filter((row) => 'configuration' in row && row.configuration === 'javascript').find(
            ({ file }) => existsSync(join(root, dirname(path), file)),
        );
        const name = lockfile?.packageManager;
        if (name !== undefined) return { name };
    }
    return { name: NPM_TOOL, version: undefined };
}

export function findPackageManagerPin(packageJson: PackageJson): PackageManagerField | undefined {
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

export function detectPackageManager(root: string, trackedPaths: string[]): PackageManagerPin {
    const packageJsonPaths = [
        PACKAGE_JSON,
        ...trackedPaths
            .filter((path) => path.endsWith(`/${PACKAGE_JSON}`) && !isGspotPath(path))
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

export async function readPackageManagerVersion(
    root: string,
    packageManager: PackageManagerPin,
    timeoutSeconds: number,
    cache: RunCache,
): Promise<PackageManager> {
    const key = JSON.stringify([root, packageManager.name, packageManager.version]);
    return await remember(cache, PACKAGE_MANAGER_VERSIONS, key, async (): Promise<PackageManager> => {
        const { name, version } = packageManager;
        if (version !== undefined) return { name, version };
        const result = await runProcess([name, VERSION_FLAG], {
            cwd: root,
            timeoutSeconds,
        });
        if (result.code !== 0)
            throw new GspotError(
                'install',
                `Cannot determine the ${name} version for the tool project. Check that ${name} --version runs in the repository, then run the command again.`,
            );
        const parsed = packageManagerSchema.safeParse({ name, version: result.stdout.trim() });
        if (!parsed.success)
            throw new GspotError(
                'install',
                `Cannot read the ${name} version for the tool project. Check that ${name} --version prints a version.`,
                { cause: parsed.error },
            );
        return parsed.data;
    });
}

/**
Select the package manager of the tool project. Yarn gives npm.
*/
export function selectToolPackageManager(name: PackageManagerPin['name']): ToolPackageManagerName {
    return name === 'yarn' ? NPM_TOOL : name;
}

export async function readToolPackageManager(
    root: string,
    packageManager: PackageManagerPin,
    timeoutSeconds: number,
    cache: RunCache,
): Promise<PackageManager & { name: ToolPackageManagerName }> {
    const name = selectToolPackageManager(packageManager.name);
    const selected = name === packageManager.name ? packageManager : { name };
    return { ...(await readPackageManagerVersion(root, selected, timeoutSeconds, cache)), name };
}

export function buildPackageManagerCommand(
    packageManager: PackageManagerCommand,
    commandArguments: readonly string[],
    node: string,
): string[] {
    const command = [packageManager.name, ...commandArguments];
    return packageManager.version === undefined
        ? command
        : ['mise', 'exec', node, `${packageManager.name}@${packageManager.version}`, '--', ...command];
}

export function buildFrozenInstallArguments(
    lockfile: keyof typeof FROZEN_INSTALLS,
    version: string | undefined,
): readonly string[] {
    const command = FROZEN_INSTALLS[lockfile];
    const isYarnBerry = command[0] === 'yarn' && version !== undefined && semver.major(version) >= YARN_BERRY_MAJOR;
    return (isYarnBerry ? YARN_BERRY_INSTALL : command).slice(1);
}
