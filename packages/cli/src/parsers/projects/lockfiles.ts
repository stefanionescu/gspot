import { posix } from 'node:path';
import { parseSyml } from '@yarnpkg/parsers';
import { isTable } from '#cli/system/tables.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { LEADING_SLASH } from '#cli/config/files/path-patterns.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/document.ts';
import type { LockfileName } from '#cli/types/parsers/projects/lockfiles.ts';
import { PACKAGE_JSON, PYTHON_NAME_SEPARATORS } from '#cli/config/parsers/projects/dependencies.ts';

import {
    uvLockSchema,
    bunLockSchema,
    npmLockSchema,
    pnpmLockSchema,
    yarnLockSchema,
    yarnPackageSchema,
    dependencySectionsSchema,
} from '#cli/schemas/parsers/projects/lockfiles.ts';
import {
    PNPM_PEER_START,
    NPM_PACKAGE_FOLDER,
    PNPM_ROOT_IMPORTER,
    DEPENDENCY_SECTIONS,
    type IMPORTER_LOCKFILES,
    type LOCKED_PACKAGE_LOCKFILES,
} from '#cli/config/parsers/projects/lockfiles.ts';

function parseNpmPackages(path: string, text: string): string[] {
    return Object.entries(parseJsonFile(path, text, npmLockSchema).packages).flatMap(([folder, lockedPackage]) => {
        const index = folder.lastIndexOf(NPM_PACKAGE_FOLDER);
        if (index === -1 || lockedPackage.version === undefined) return [];
        return [`${folder.slice(index + NPM_PACKAGE_FOLDER.length)}@${lockedPackage.version}`];
    });
}

function parsePnpmPackages(path: string, text: string): string[] {
    return Object.keys(parseYamlFile(path, text, pnpmLockSchema).packages).map((key) => {
        const name = key.replace(LEADING_SLASH, '');
        const peers = name.indexOf(PNPM_PEER_START);
        return peers === -1 ? name : name.slice(0, peers);
    });
}

function parseYarnPackages(_path: string, text: string): string[] {
    return Object.entries(yarnLockSchema.parse(parseSyml(text))).flatMap(([descriptors, yarnPackage]) => {
        const version = yarnPackageSchema.safeParse(yarnPackage);
        const name = splitIdentity(descriptors.split(',', 1)[0]?.trim() ?? '')?.[0];
        return version.success && version.data.version !== undefined && name !== undefined
            ? [`${name}@${version.data.version}`]
            : [];
    });
}

const PACKAGE_PARSERS: Readonly<
    Record<(typeof LOCKED_PACKAGE_LOCKFILES)[number], (path: string, text: string) => string[]>
> = {
    'package-lock.json': parseNpmPackages,
    'npm-shrinkwrap.json': parseNpmPackages,
    'bun.lock': (path, text) =>
        Object.values(parseJsonFile(path, text, bunLockSchema).packages).flatMap(([identity]) =>
            typeof identity === 'string' && splitIdentity(identity) !== undefined ? [identity] : [],
        ),
    'pnpm-lock.yaml': parsePnpmPackages,
    'yarn.lock': parseYarnPackages,
    'uv.lock': (path, text) =>
        parseTomlFile(path, text, uvLockSchema).package.flatMap(({ name, version }) =>
            version === undefined ? [] : [`${name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-')}@${version}`],
        ),
};

function listSpecifiers(workspace: unknown): Map<string, string> {
    const parsed = dependencySectionsSchema.safeParse(workspace);
    if (!parsed.success) return new Map();
    return new Map(
        DEPENDENCY_SECTIONS.flatMap((section) => {
            const dependencies = parsed.data[section];
            if (dependencies === undefined) return [];
            return Object.entries(dependencies).flatMap(([name, value]): [string, string][] => {
                if (typeof value === 'string') return [[name, value]];
                const specifier = isTable(value) ? value['specifier'] : undefined;
                return typeof specifier === 'string' ? [[name, specifier]] : [];
            });
        }),
    );
}

function parseNpmVersions(path: string, text: string, folder: string): Map<string, string> {
    const { packages } = parseJsonFile(path, text, npmLockSchema);
    const specifiers = listSpecifiers(packages[folder]);
    return new Map(
        [...specifiers.keys()].flatMap((name): [string, string][] => {
            const version = listEnclosingFolders(folder)
                .map((base) => packages[posix.join(base, NPM_PACKAGE_FOLDER, name)]?.version)
                .find((lockedVersion) => lockedVersion !== undefined);
            return version === undefined ? [] : [[name, version]];
        }),
    );
}

function parseBunVersions(path: string, text: string, folder: string): Map<string, string> {
    const lockfile = parseJsonFile(path, text, bunLockSchema);
    const workspace = lockfile.workspaces[folder];
    const importer = isTable(workspace) && typeof workspace['name'] === 'string' ? workspace['name'] : folder;
    return new Map(
        [...listSpecifiers(workspace).keys()].flatMap((name): [string, string][] => {
            const identity = (lockfile.packages[posix.join(importer, name)] ?? lockfile.packages[name])?.[0];
            const version = typeof identity === 'string' ? splitIdentity(identity)?.[1] : undefined;
            return version === undefined ? [] : [[name, version]];
        }),
    );
}

function parsePnpmVersions(path: string, text: string, folder: string): Map<string, string> {
    const { importers } = parseYamlFile(path, text, pnpmLockSchema);
    const workspace = dependencySectionsSchema.safeParse(importers[folder === '' ? PNPM_ROOT_IMPORTER : folder]);
    if (!workspace.success) return new Map();
    return new Map(
        DEPENDENCY_SECTIONS.flatMap((section) => {
            const dependencies = workspace.data[section];
            if (dependencies === undefined) return [];
            return Object.entries(dependencies).flatMap(([name, locked]): [string, string][] => {
                const version = isTable(locked) ? locked['version'] : locked;
                return typeof version === 'string' ? [[name, version.split(PNPM_PEER_START, 1).join('')]] : [];
            });
        }),
    );
}

function parseYarnVersions(text: string, specifiers: Map<string, string>): Map<string, string> {
    const packages = Object.entries(yarnLockSchema.parse(parseSyml(text)));
    const versions = [...specifiers].flatMap(([name, specifier]): [string, string][] => {
        const descriptors = new Set([`${name}@${specifier}`, `${name}@npm:${specifier}`]);
        const found = packages.find(([keys]) => keys.split(',').some((key) => descriptors.has(key.trim())));
        const parsed = yarnPackageSchema.safeParse(found?.[1]);
        return parsed.success && parsed.data.version !== undefined ? [[name, parsed.data.version]] : [];
    });
    return new Map(versions);
}

const SPECIFIER_PARSERS: Readonly<
    Record<(typeof IMPORTER_LOCKFILES)[number], (path: string, text: string) => [string, unknown][]>
> = {
    'package-lock.json': (path, text) =>
        Object.entries(parseJsonFile(path, text, npmLockSchema).packages).filter(
            ([key]) => !key.includes(NPM_PACKAGE_FOLDER),
        ),
    'bun.lock': (path, text) => Object.entries(parseJsonFile(path, text, bunLockSchema).workspaces),
    'pnpm-lock.yaml': (path, text) => Object.entries(parseYamlFile(path, text, pnpmLockSchema).importers),
};

/**
 * Split a package identity into its name and version. The separator follows the name; a scoped name starts with @.
 *
 * @param identity the package as `name@version`.
 * @returns the name and the version, or undefined without a version.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 7 calls in 4 files share it.
export function splitIdentity(identity: string): [string, string] | undefined {
    const separator = identity.indexOf('@', 1);
    return separator === -1 ? undefined : [identity.slice(0, separator), identity.slice(separator + 1)];
}

/**
 * Find the nearest lockfile of a project, from its folder up to the repository root, and list what it holds.
 *
 * @param reads the run cache, rooted at the repository.
 * @param folder the project folder, relative to the repository root.
 * @param lockfiles the lockfile names of the project's package manager family, in the order to try.
 * @returns each locked package as `name@version`, or undefined when no lockfile sits on the way to the root.
 */
export function readLockedPackages(
    reads: ReadCache,
    folder: string,
    lockfiles: readonly (typeof LOCKED_PACKAGE_LOCKFILES)[number][],
): Set<string> | undefined {
    for (const base of listEnclosingFolders(folder)) {
        for (const lockfile of lockfiles) {
            const path = posix.join(base, lockfile);
            const text = findCachedText(reads, path);
            if (text !== undefined) return new Set(PACKAGE_PARSERS[lockfile](path, text));
        }
    }
    return undefined;
}

/**
 * Read the versions that a project's direct dependencies resolve to in its nearest lockfile.
 *
 * @param reads the repository read cache.
 * @param folder the project folder relative to the repository.
 * @param lockfiles the lockfile names in preference order.
 * @returns each direct dependency's version, or undefined without a lockfile.
 */
export function readLockedVersions(
    reads: ReadCache,
    folder: string,
    lockfiles: readonly LockfileName[],
): Map<string, string> | undefined {
    const parsers: Record<LockfileName, (path: string, text: string, importer: string) => Map<string, string>> = {
        'package-lock.json': parseNpmVersions,
        'npm-shrinkwrap.json': parseNpmVersions,
        'bun.lock': parseBunVersions,
        'pnpm-lock.yaml': parsePnpmVersions,
        'yarn.lock': (_path, text) => {
            const manifest = posix.join(folder, PACKAGE_JSON);
            const content = findCachedText(reads, manifest);
            const specifiers =
                content === undefined
                    ? new Map<string, string>()
                    : listSpecifiers(parseJsonFile(manifest, content, dependencySectionsSchema));
            return parseYarnVersions(text, specifiers);
        },
    };
    for (const base of listEnclosingFolders(folder))
        for (const lockfile of lockfiles) {
            const path = posix.join(base, lockfile);
            const text = findCachedText(reads, path);
            if (text !== undefined) return parsers[lockfile](path, text, posix.relative(base, folder));
        }
    return undefined;
}

/**
 * Parse the dependency specifiers that a lockfile records for each workspace.
 *
 * @param lockfile the lockfile name, which selects its format.
 * @param text the lockfile contents.
 * @param path the repository-relative lockfile path.
 * @returns the dependency specifiers for each folder, with an empty key for the root.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The lockfile formats it reads stay private to this parser.
export function parseLockedSpecifiers(
    lockfile: (typeof IMPORTER_LOCKFILES)[number],
    text: string,
    path: string,
): Map<string, Map<string, string>> {
    return new Map(
        SPECIFIER_PARSERS[lockfile](path, text).map(([key, workspace]) => [
            key === PNPM_ROOT_IMPORTER ? '' : key,
            listSpecifiers(workspace),
        ]),
    );
}
