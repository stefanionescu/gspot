import { posix } from 'node:path';
import { parseSyml } from '@yarnpkg/parsers';
import { isTable } from '#cli/system/tables.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import { type ReadCache } from '#cli/types/system/files.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { NPM_PACKAGE_FOLDER } from '#cli/config/files/names.ts';
import { LEADING_SLASH } from '#cli/config/files/path-patterns.ts';
import { GspotError, parseFileFields } from '#cli/system/errors.ts';
import { type LockfileName } from '#cli/types/parsers/projects/lockfiles.ts';
import { PACKAGE_JSON, PYTHON_NAME_SEPARATORS } from '#cli/config/parsers/projects/dependencies.ts';

import {
    uvLockfileSchema,
    bunLockfileSchema,
    npmLockfileSchema,
    yarnPackageSchema,
    pnpmLockfileSchema,
    yarnLockfileSchema,
    dependencySectionsSchema,
} from '#cli/schemas/parsers/projects/lockfiles.ts';
import {
    PNPM_PEER_START,
    PNPM_ROOT_IMPORTER,
    YARN_CLASSIC_HEADER,
    LOCKFILE_URL_FIELDS,
    DEPENDENCY_SECTIONS,
    YARN_CLASSIC_PROPERTY,
    type IMPORTER_LOCKFILES,
    type LOCKED_PACKAGE_LOCKFILES,
} from '#cli/config/parsers/projects/lockfiles.ts';

function parseNpmPackages(path: string, text: string): string[] {
    return Object.entries(parseJsonFile(path, text, npmLockfileSchema).packages).flatMap(([folder, lockedPackage]) => {
        const index = folder.lastIndexOf(NPM_PACKAGE_FOLDER);
        return index === -1 || lockedPackage.version === undefined
            ? []
            : `${folder.slice(index + NPM_PACKAGE_FOLDER.length)}@${lockedPackage.version}`;
    });
}

function parsePnpmPackages(path: string, text: string): string[] {
    return Object.keys(parseYamlFile(path, text, pnpmLockfileSchema).packages).map((key) => {
        const name = key.replace(LEADING_SLASH, '');
        const peers = name.indexOf(PNPM_PEER_START);
        return peers === -1 ? name : name.slice(0, peers);
    });
}

function parseYarnPackages(path: string, text: string): string[] {
    return Object.entries(parseYarnLockfile(path, text)).flatMap(([descriptors, yarnPackage]) => {
        const version = yarnPackageSchema.safeParse(yarnPackage);
        const name = splitIdentity(descriptors.split(',', 1)[0]?.trim() ?? '')?.[0];
        return name !== undefined && version.success && version.data.version !== undefined
            ? `${name}@${version.data.version}`
            : [];
    });
}

export const PACKAGE_PARSERS: Readonly<
    Record<(typeof LOCKED_PACKAGE_LOCKFILES)[number], (path: string, text: string) => string[]>
> = {
    'package-lock.json': parseNpmPackages,
    'npm-shrinkwrap.json': parseNpmPackages,
    'bun.lock': (path, text) =>
        Object.values(parseJsonFile(path, text, bunLockfileSchema).packages).flatMap(([identity]) =>
            typeof identity === 'string' && splitIdentity(identity) !== undefined ? [identity] : [],
        ),
    'pnpm-lock.yaml': parsePnpmPackages,
    'yarn.lock': parseYarnPackages,
    'uv.lock': (path, text) =>
        parseTomlFile(path, text, uvLockfileSchema).package.flatMap(({ name, version }) =>
            version === undefined ? [] : `${name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-')}@${version}`,
        ),
};

/**
Read the declared package requirements from the selected dependency tables.

@param workspace the package or importer record to inspect.
@param sections the dependency tables to read in order.
*/
export function listSpecifiers(
    workspace: unknown,
    sections: readonly ((typeof DEPENDENCY_SECTIONS)[number] | 'peerDependencies')[] = DEPENDENCY_SECTIONS,
): Map<string, string> {
    const parsed = dependencySectionsSchema.safeParse(workspace);
    if (!parsed.success) return new Map();
    return new Map(
        sections.flatMap((section) => {
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
    const { packages } = parseJsonFile(path, text, npmLockfileSchema);
    const specifiers = listSpecifiers(packages[folder]);
    return new Map(
        specifiers.keys().flatMap((name): [string, string][] => {
            const version = listEnclosingFolders(folder)
                .map((base) => packages[posix.join(base, NPM_PACKAGE_FOLDER, name)]?.version)
                .find((lockedVersion) => lockedVersion !== undefined);
            return version === undefined ? [] : [[name, version]];
        }),
    );
}

function parseBunVersions(path: string, text: string, folder: string): Map<string, string> {
    const lockfile = parseJsonFile(path, text, bunLockfileSchema);
    const workspace = lockfile.workspaces[folder];
    const importer = isTable(workspace) && typeof workspace['name'] === 'string' ? workspace['name'] : folder;
    return new Map(
        listSpecifiers(workspace)
            .keys()
            .flatMap((name): [string, string][] => {
                const identity = (lockfile.packages[posix.join(importer, name)] ?? lockfile.packages[name])?.[0];
                const version = typeof identity === 'string' ? splitIdentity(identity)?.[1] : undefined;
                return version === undefined ? [] : [[name, version]];
            }),
    );
}

function parsePnpmVersions(path: string, text: string, folder: string): Map<string, string> {
    const { importers } = parseYamlFile(path, text, pnpmLockfileSchema);
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

function parseYarnVersions(path: string, text: string, specifiers: Map<string, string>): Map<string, string> {
    const packages = Object.entries(parseYarnLockfile(path, text));
    const versions = [...specifiers].flatMap(([name, specifier]): [string, string][] => {
        const descriptors = new Set([`${name}@${specifier}`, `${name}@npm:${specifier}`]);
        const found = packages.find(([keys]) => keys.split(',').some((key) => descriptors.has(key.trim())));
        const parsed = yarnPackageSchema.safeParse(found?.[1]);
        return parsed.success && parsed.data.version !== undefined ? [[name, parsed.data.version]] : [];
    });
    return new Map(versions);
}

export const SPECIFIER_PARSERS: Readonly<
    Record<(typeof IMPORTER_LOCKFILES)[number], (path: string, text: string) => [string, unknown][]>
> = {
    'package-lock.json': (path, text) =>
        Object.entries(parseJsonFile(path, text, npmLockfileSchema).packages).filter(
            ([key]) => !key.includes(NPM_PACKAGE_FOLDER),
        ),
    'bun.lock': (path, text) => Object.entries(parseJsonFile(path, text, bunLockfileSchema).workspaces),
    'pnpm-lock.yaml': (path, text) => Object.entries(parseYamlFile(path, text, pnpmLockfileSchema).importers),
};

/**
Split a package identity into its name and version. The separator follows the name; a scoped name starts with @.

@param identity the package as `name@version`.
@returns the name and the version, or undefined without a version.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 7 calls in 4 files share it.
export function splitIdentity(identity: string): [string, string] | undefined {
    const separator = identity.indexOf('@', 1);
    return separator === -1 ? undefined : [identity.slice(0, separator), identity.slice(separator + 1)];
}

/**
Find the first lockfile from a folder up to the repository root.

@param reads the repository cache.
@param folder the starting project folder.
@param lockfiles the lockfile names in preference order.
@returns undefined without a lockfile.
*/
export function findNearestLockfile<Name extends string>(
    reads: ReadCache,
    folder: string,
    lockfiles: readonly Name[],
): { lockfile: Name; path: string; base: string; text: string } | undefined {
    for (const base of listEnclosingFolders(folder)) {
        for (const lockfile of lockfiles) {
            const path = posix.join(base, lockfile);
            const text = findCachedText(reads, path);
            if (text !== undefined) return { lockfile, path, base, text };
        }
    }
    return undefined;
}

/**
Read the versions that a project's direct dependencies resolve to in its nearest lockfile.

@param reads the repository read cache.
@param folder the project folder relative to the repository.
@param lockfiles the lockfile names in preference order.
@returns undefined without a lockfile.
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
        'yarn.lock': (path, text) => {
            const manifest = posix.join(folder, PACKAGE_JSON);
            const content = findCachedText(reads, manifest);
            const specifiers =
                content === undefined
                    ? new Map<string, string>()
                    : listSpecifiers(parseJsonFile(manifest, content, dependencySectionsSchema));
            return parseYarnVersions(path, text, specifiers);
        },
    };
    const found = findNearestLockfile(reads, folder, lockfiles);
    return found === undefined
        ? undefined
        : parsers[found.lockfile](found.path, found.text, posix.relative(found.base, folder));
}

/**
Parse a yarn.lock file and reject other formats.

@param path the file, for the error.
@param text the saved dependency records to decode.
@returns the packages of the lockfile, by key.
*/
function parseYarnLockfile(path: string, text: string): Record<string, unknown> {
    let parsed: unknown;
    try {
        parsed = parseSyml(YARN_CLASSIC_PROPERTY.test(text) ? YARN_CLASSIC_HEADER + text : text);
    } catch (error) {
        throw new GspotError('parse', `${path} is not valid Yarn lock syntax. Fix the lockfile.`, { cause: error });
    }
    return parseFileFields(path, parsed, yarnLockfileSchema);
}

/**
List package download URLs from a JavaScript lockfile. Read resolved fields for npm and Yarn, tarball and repo fields for pnpm, and package identities and tuple values for Bun.

@param path the lockfile path, whose file name gives the format.
@param text the serialized package records to inspect for download addresses.
@returns the URLs, in the order of the lockfile.
*/
export function listLockfileUrls(path: string, text: string): string[] {
    const parsed = parseLockfileDocument(path, text);
    const urls = posix.basename(path) === 'bun.lock' ? listBunUrls(parsed) : [];
    const pending: unknown[] = [parsed];
    while (pending.length > 0) {
        const fields = listDownloadFields(pending.pop());
        urls.push(...fields.urls);
        pending.push(...fields.children.toReversed());
    }
    return urls;
}

function parseLockfileDocument(path: string, text: string): unknown {
    const name = posix.basename(path);
    if (name === 'yarn.lock') return parseYarnLockfile(path, text);
    if (name.endsWith('.yaml')) return parseYamlFile(path, text);
    if (name === 'uv.lock') return parseTomlFile(path, text);
    return parseJsonFile(path, text);
}

function listUrlChildren(value: unknown): [string, unknown][] {
    if (Array.isArray(value)) return (value as unknown[]).map((field) => ['', field]);
    if (isTable(value)) return Object.entries(value);
    return [];
}

function listBunUrls(document: unknown): string[] {
    const packages = isTable(document) ? document['packages'] : undefined;
    if (!isTable(packages)) return [];
    return Object.values(packages).flatMap((record): string[] => {
        if (!Array.isArray(record)) return [];
        const identity = typeof record[0] === 'string' ? splitIdentity(record[0])?.[1] : undefined;
        return [identity, record[1]].filter(
            (value): value is string => typeof value === 'string' && URL.canParse(value),
        );
    });
}

function listDownloadFields(value: unknown) {
    const urls: string[] = [];
    const children: unknown[] = [];
    for (const [key, field] of listUrlChildren(value)) {
        if (typeof field === 'string' && LOCKFILE_URL_FIELDS.includes(key)) {
            const identity = splitIdentity(field)?.[1];
            urls.push(identity !== undefined && URL.canParse(identity) ? identity : field);
        }
        children.push(field);
    }
    return { urls, children };
}
