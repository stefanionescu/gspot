import { posix } from 'node:path';
import { parseSyml } from '@yarnpkg/parsers';
import { isRecord } from '#cli/system/tables.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { parseYamlFile } from '#cli/parsers/yaml.ts';
import { LEADING_SLASH } from '#cli/config/system/paths.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { parseTomlFile } from '#cli/parsers/toml/document.ts';
import { PYTHON_NAME_SEPARATORS } from '#cli/config/parsers/dependencies.ts';

import {
    uvLockSchema,
    npmLockSchema,
    bunLockSchema,
    pnpmLockSchema,
    yarnLockSchema,
    yarnPackageSchema,
    dependencySectionsSchema,
} from '#cli/schemas/parsers/lockfiles.ts';
import {
    PNPM_PEER_START,
    NPM_PACKAGE_FOLDER,
    PNPM_ROOT_IMPORTER,
    DEPENDENCY_SECTIONS,
    type IMPORTER_LOCKFILES,
    type LOCKED_PACKAGE_LOCKFILES,
} from '#cli/config/parsers/lockfiles.ts';

function parseNpmPackages(path: string, text: string): string[] {
    return Object.entries(parseJsonFile(path, text, npmLockSchema).packages).flatMap(([folder, entry]) => {
        const index = folder.lastIndexOf(NPM_PACKAGE_FOLDER);
        if (index === -1 || entry.version === undefined) return [];
        return [`${folder.slice(index + NPM_PACKAGE_FOLDER.length)}@${entry.version}`];
    });
}

function parseBunPackages(path: string, text: string): string[] {
    return Object.values(parseJsonFile(path, text, bunLockSchema).packages).flatMap(([identity]) =>
        typeof identity === 'string' && splitIdentity(identity) !== undefined ? [identity] : [],
    );
}

function parsePnpmPackages(path: string, text: string): string[] {
    return Object.keys(parseYamlFile(path, text, pnpmLockSchema).packages).map((key) => {
        const name = key.replace(LEADING_SLASH, '');
        const peers = name.indexOf(PNPM_PEER_START);
        return peers === -1 ? name : name.slice(0, peers);
    });
}

function parseYarnPackages(_path: string, text: string): string[] {
    return Object.entries(yarnLockSchema.parse(parseSyml(text))).flatMap(([descriptors, entry]) => {
        const version = yarnPackageSchema.safeParse(entry);
        const name = splitIdentity(descriptors.split(',', 1)[0]?.trim() ?? '')?.[0];
        return version.success && version.data.version !== undefined && name !== undefined
            ? [`${name}@${version.data.version}`]
            : [];
    });
}

function parseUvPackages(path: string, text: string): string[] {
    return parseTomlFile(path, text, uvLockSchema).package.flatMap(({ name, version }) =>
        version === undefined ? [] : [`${name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-')}@${version}`],
    );
}

const PACKAGE_PARSERS: Readonly<
    Record<(typeof LOCKED_PACKAGE_LOCKFILES)[number], (path: string, text: string) => string[]>
> = {
    'package-lock.json': parseNpmPackages,
    'npm-shrinkwrap.json': parseNpmPackages,
    'bun.lock': parseBunPackages,
    'pnpm-lock.yaml': parsePnpmPackages,
    'yarn.lock': parseYarnPackages,
    'uv.lock': parseUvPackages,
};

// The specifier of each dependency in one workspace entry. pnpm records { specifier, version } for each.
function listSpecifiers(entry: unknown): Map<string, string> {
    const parsed = dependencySectionsSchema.safeParse(entry);
    if (!parsed.success) return new Map();
    return new Map(
        DEPENDENCY_SECTIONS.flatMap((section) => {
            const dependencies = parsed.data[section];
            if (dependencies === undefined) return [];
            return Object.entries(dependencies).flatMap(([name, value]): [string, string][] => {
                if (typeof value === 'string') return [[name, value]];
                const specifier = isRecord(value) ? value['specifier'] : undefined;
                return typeof specifier === 'string' ? [[name, specifier]] : [];
            });
        }),
    );
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
 * Parse the dependency specifiers that a lockfile records for each workspace.
 *
 * @param lockfile the lockfile name, which selects its format.
 * @param text the lockfile contents.
 * @param path the repository-relative lockfile path.
 * @returns the dependency specifiers for each folder, with an empty key for the root.
 */
export function parseLockedSpecifiers(
    lockfile: (typeof IMPORTER_LOCKFILES)[number],
    text: string,
    path: string,
): Map<string, Map<string, string>> {
    return new Map(
        SPECIFIER_PARSERS[lockfile](path, text).map(([key, entry]) => [
            key === PNPM_ROOT_IMPORTER ? '' : key,
            listSpecifiers(entry),
        ]),
    );
}
