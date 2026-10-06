// Shared dependency lock readers provide installed identities and root pins.
import { parse as parseYaml } from 'yaml';
import { parseSyml } from '@yarnpkg/parsers';
import { parse as parseToml } from 'smol-toml';
import { parseJsonc } from '#cli/parsers/jsonc.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { normalizedPythonPackage } from '#cli/parsers/packages.ts';
import type { DependencyMap } from '#cli/types/parsers/packages.ts';
import type { LockName, Lockfile, LockFileName } from '#cli/types/parsers/lockfiles.ts';

import {
    bunLockSchema,
    npmLockSchema,
    pnpmLockSchema,
    npmVersionSchema,
    pythonLockSchema,
    npmPackagesSchema,
    yarnRecordsSchema,
    pnpmPackagesSchema,
    yarnPackagesSchema,
    bunIdentitiesSchema,
    npmDependencySchema,
    pnpmSpecifiersSchema,
    npmDependenciesSchema,
} from '#cli/parsers/schema/lockfiles.ts';

// The name@version a pnpm lock key names: an optional scope, the name, @ or /, then the version up to ( or _.
function pnpmIdentity(key: string): string | undefined {
    const identity = key.startsWith('/') ? key.slice(1) : key;
    const scopeEnd = identity.startsWith('@') ? identity.indexOf('/') : -1;
    if (identity.startsWith('@') && scopeEnd <= 1) return undefined;
    const separator = identity.slice(scopeEnd + 1).search(/[@/]/u);
    if (separator < 1) return undefined;
    const nameEnd = scopeEnd + 1 + separator;
    const rest = identity.slice(nameEnd + 1);
    const versionEnd = rest.search(/[(_]/u);
    const version = versionEnd === -1 ? rest : rest.slice(0, versionEnd);
    return version === '' ? undefined : `${identity.slice(0, nameEnd)}@${version}`;
}

function pythonLock(text: string): Set<string> {
    const lock = pythonLockSchema.parse(parseLockfile('uv.lock', text));
    return new Set(lock.package.map(({ name, version }) => `${normalizedPythonPackage(name)}@${version}`));
}

function npmDependencyTree(parsed: unknown): Set<string> {
    const lock = npmDependenciesSchema.parse(parsed);
    const pending = Object.entries(lock.dependencies);
    const identities = new Set<string>();
    while (pending.length > 0) {
        const item = pending.pop();
        if (item === undefined) break;
        const [name, value] = item;
        const entry = npmDependencySchema.parse(value);
        identities.add(
            entry.version.startsWith('npm:') ? entry.version.slice('npm:'.length) : `${name}@${entry.version}`,
        );
        pending.push(...(entry.dependencies === undefined ? [] : Object.entries(entry.dependencies)));
    }
    return identities;
}

const LOCK_READERS = new Map<string, (text: string) => Set<string>>([
    ['uv.lock', pythonLock],
    ['poetry.lock', pythonLock],
    ['pdm.lock', pythonLock],
    [
        'package-lock.json',
        (text) => {
            const parsed: unknown = parseLockfile('package-lock.json', text);
            const version = npmVersionSchema.parse(parsed).lockfileVersion;
            if (version === 1) return npmDependencyTree(parsed);
            const lock = npmPackagesSchema.parse(parsed);
            return new Set(
                Object.entries(lock.packages).flatMap(([path, entry]) => {
                    if (entry.version === undefined) return [];
                    const name = entry.name ?? path.split('node_modules/').at(-1);
                    return name === undefined || name === '' ? [] : [`${name}@${entry.version}`];
                }),
            );
        },
    ],
    [
        'bun.lock',
        (text) => {
            const lock = bunIdentitiesSchema.parse(parseLockfile('bun.lock', text));
            return new Set(
                Object.values(lock.packages)
                    .map(([identity]) => identity)
                    .filter((identity) => /@\d/u.test(identity)),
            );
        },
    ],
    [
        'pnpm-lock.yaml',
        (text) => {
            const lock = pnpmPackagesSchema.parse(parseLockfile('pnpm-lock.yaml', text));
            return new Set(
                Object.keys(lock.packages).map((key) => {
                    const identity = pnpmIdentity(key);
                    if (identity === undefined)
                        throw new Error('Cannot read a resolved package identity from the pnpm lockfile.');
                    return identity;
                }),
            );
        },
    ],
    [
        'yarn.lock',
        (text) => {
            const entries = yarnRecordsSchema.parse(parseLockfile('yarn.lock', text));
            const lock = yarnPackagesSchema.parse(
                Object.fromEntries(Object.entries(entries).filter(([name]) => name !== '__metadata')),
            );
            return new Set(
                Object.entries(lock).flatMap(([descriptors, entry]) => {
                    if (entry.version === undefined) return [];
                    const descriptor = entry.resolution ?? descriptors.split(/,\s*/u, 1)[0] ?? descriptors;
                    const separator = descriptor.indexOf('@', 1);
                    if (separator < 1)
                        throw new Error('Cannot read a resolved package identity from the Yarn lockfile.');
                    const reference = descriptor.slice(separator + 1);
                    if (reference.startsWith('npm:')) {
                        const alias = reference.slice('npm:'.length);
                        const versionSeparator = alias.lastIndexOf('@');
                        if (versionSeparator > 0) return [`${alias.slice(0, versionSeparator)}@${entry.version}`];
                    }
                    return [`${descriptor.slice(0, separator)}@${entry.version}`];
                }),
            );
        },
    ],
]);

/**
 * Parse a supported textual lockfile using its native syntax.
 * @param filename the supported lockfile name
 * @param text the complete lockfile source
 * @returns the parsed value for format-specific validation
 */
export function parseLockfile(filename: LockFileName, text: string): unknown {
    if (filename === 'bun.lock') return parseJsonc(text);
    if (filename === 'package-lock.json') return JSON.parse(text);
    if (filename === 'pnpm-lock.yaml') return parseYaml(text);
    if (filename === 'yarn.lock') return parseSyml(text);
    return parseToml(text);
}

/**
 * Read the exact root development dependencies recorded by npm, Bun, or pnpm.
 * @param name the package manager
 * @param content the complete lockfile source
 * @returns root dependency names and their declared specifiers
 */
export function rootLockDependencies(name: Exclude<LockName, 'yarn'>, content: string): DependencyMap {
    if (name === 'npm' || name === 'bun') {
        const root =
            name === 'npm'
                ? npmLockSchema.parse(parseLockfile('package-lock.json', content)).packages['']
                : bunLockSchema.parse(parseLockfile('bun.lock', content)).workspaces[''];
        if (root?.devDependencies === undefined) return {};
        return root.devDependencies;
    }
    const pinned = pnpmLockSchema.parse(parseLockfile('pnpm-lock.yaml', content)).importers['.']?.devDependencies;
    const entries = pnpmSpecifiersSchema.parse(pinned);
    return Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, value.specifier]));
}

/**
 * Read resolved package identities from supported textual dependency lockfiles.
 * @param filename the lockfile name, which names its format
 * @param text the lockfile text
 * @returns each resolved package as name@version
 */
export function lockedPackages(filename: string, text: string): Set<string> {
    const read = LOCK_READERS.get(filename);
    if (read === undefined)
        throw new Error(
            `Cannot read packages from ${filename}. gspot reads uv.lock, poetry.lock, pdm.lock, package-lock.json, bun.lock, pnpm-lock.yaml, and yarn.lock.`,
        );
    return read(text);
}

/**
 * Read the declared consumers of one repository lockfile.
 * @param filename the file basename
 * @returns its metadata, or undefined for an unsupported filename
 */
export function lockfileEntry(filename: string): Lockfile | undefined {
    return LOCKFILES.find((entry) => entry.file === filename);
}
