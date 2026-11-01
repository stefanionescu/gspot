import semver from 'semver';
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import type { Dependencies } from '#cli/types/parsers.ts';
import { bunLockfileSchema } from '#cli/schemas/parsers.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import { LOCKFILES } from '#cli/config/repository/javascript.ts';
import { modify, applyEdits } from 'jsonc-parser/lib/esm/main.js';
import { PNPM_PEER_START, NPM_PACKAGE_FOLDER, PNPM_ROOT_IMPORTER } from '#cli/config/parsers.ts';
import { stripPnpmKey, splitIdentity, readNpmKeyName } from '#cli/parsers/projects/lockfiles.ts';
import { INTEGRITY, BUN_LOCKFILE, NPM_SETTING_PREFIX, LOCKFILE_WORKSPACE_KEYS } from '#cli/config/tools/installers.ts';

import {
    bunPackageSchema,
    npmToolLockSchemas,
    npmToolPackageSchema,
    pnpmToolPackageSchema,
} from '#cli/schemas/tools.ts';
import type {
    Lockfile,
    BunPackage,
    LockedTarball,
    ToolPackageManagerName,
    ToolProjectLockfileName,
} from '#cli/types/tools.ts';

function findPackageRegistry(name: string, environment: Record<string, string>): string | undefined {
    const scope = name.startsWith('@') ? name.split('/', 1)[0] : undefined;
    const scopeRegistry = scope === undefined ? undefined : environment[`${NPM_SETTING_PREFIX}${scope}:registry`];
    return scopeRegistry ?? environment[`${NPM_SETTING_PREFIX}registry`];
}

function isStandardTarball(tarball: LockedTarball, environment: Record<string, string>): boolean {
    const { name, version, address, integrity } = tarball;
    if (semver.valid(version) === null || !INTEGRITY.test(integrity)) return false;
    const registry = findPackageRegistry(name, environment);
    if (registry === undefined) return false;
    const base = registry.endsWith('/') ? registry : `${registry}/`;
    const filename = posix.basename(name);
    return address === '' || address === new URL(`${name}/-/${filename}-${version}.tgz`, base).href;
}

function isStandardBunTarball(bunPackage: BunPackage, environment: Record<string, string>): boolean {
    const [identity, address, , integrity] = bunPackage;
    const separator = identity.lastIndexOf('@');
    const name = identity.slice(0, separator);
    const version = identity.slice(separator + 1);
    return isStandardTarball({ name, version, address, integrity }, environment);
}

function parseDevelopmentDependencies(
    packageManager: ToolPackageManagerName,
    workspace: unknown,
): Dependencies | undefined {
    if (!isTable(workspace)) return undefined;
    const dependencies = workspace['devDependencies'];
    if (dependencies === undefined) return {};
    if (!isTable(dependencies)) return undefined;
    const pins: Dependencies = {};
    for (const [dependency, value] of Object.entries(dependencies)) {
        const specifier = packageManager === 'pnpm' ? findValueAt(value, ['specifier']) : value;
        if (typeof specifier !== 'string') return undefined;
        pins[dependency] = specifier;
    }
    return pins;
}

function parseToolLockfile(packageManager: ToolPackageManagerName, lockfile: string): Record<string, unknown> {
    const path = selectLockfileName(packageManager);
    const schema = npmToolLockSchemas[packageManager];
    return packageManager === 'pnpm'
        ? parseYamlFile<Record<string, unknown>>(path, lockfile, schema)
        : parseJsonFile<Record<string, unknown>>(path, lockfile, schema);
}

function parseRootDependencies(
    packageManager: ToolPackageManagerName,
    document: Record<string, unknown>,
): Dependencies | undefined {
    const workspaces = document[LOCKFILE_WORKSPACE_KEYS[packageManager]];
    if (!isTable(workspaces)) return undefined;
    let root: Dependencies = {};
    for (const [key, workspace] of Object.entries(workspaces)) {
        const dependencies = parseDevelopmentDependencies(packageManager, workspace);
        if (dependencies === undefined) return undefined;
        if (key === (packageManager === 'pnpm' ? PNPM_ROOT_IMPORTER : '')) root = dependencies;
    }
    return root;
}

function getBunPackageName(key: string): string {
    const scope = posix.basename(posix.dirname(key));
    const name = posix.basename(key);
    return scope.startsWith('@') ? `${scope}/${name}` : name;
}

function hasStandardBunPackages(document: Record<string, unknown>, environment: Record<string, string>): boolean {
    const packages = document['packages'] as Record<string, unknown[]>;
    return Object.entries(packages).every(([key, value]) => {
        const parsed = bunPackageSchema.safeParse(value);
        if (!parsed.success) return false;
        const identity = splitIdentity(parsed.data[0]);
        return identity?.[0] === getBunPackageName(key) && isStandardBunTarball(parsed.data, environment);
    });
}

function hasStandardNpmPackages(document: Record<string, unknown>, environment: Record<string, string>): boolean {
    const packages = document['packages'] as Record<string, Record<string, unknown>>;
    return Object.entries(packages).every(([key, lockedPackage]) => {
        if (!key.includes(NPM_PACKAGE_FOLDER)) return true;
        const name = readNpmKeyName(key);
        const parsed = npmToolPackageSchema.safeParse(lockedPackage);
        if (!parsed.success) return false;
        const { version, resolved = '', integrity, name: identity = name } = parsed.data;
        return identity === name && isStandardTarball({ name, version, address: resolved, integrity }, environment);
    });
}

function hasStandardPnpmPackages(document: Record<string, unknown>, environment: Record<string, string>): boolean {
    const packages = document['packages'] as Record<string, unknown>;
    return Object.entries(packages).every(([key, lockedPackage]) => {
        const identity = splitIdentity(stripPnpmKey(key));
        const parsed = pnpmToolPackageSchema.safeParse(lockedPackage);
        if (identity === undefined || !parsed.success) return false;
        const [name, version] = identity;
        const {
            name: installed = name,
            resolution: { tarball = '', integrity },
        } = parsed.data;
        return installed === name && isStandardTarball({ name, version, address: tarball, integrity }, environment);
    });
}

function isPinLocked(
    packageManager: ToolPackageManagerName,
    document: Record<string, unknown>,
    [name, version]: [string, string],
): boolean {
    const packages = document['packages'] as Record<string, unknown>;
    if (packageManager === 'bun') return findValueAt(packages, [name, '0']) === `${name}@${version}`;
    if (packageManager === 'npm') return findValueAt(packages, [`${NPM_PACKAGE_FOLDER}${name}`, 'version']) === version;
    const locked = findValueAt(document, ['importers', PNPM_ROOT_IMPORTER, 'devDependencies', name, 'version']);
    return (
        typeof locked === 'string' &&
        locked.split(PNPM_PEER_START, 1)[0] === version &&
        Object.hasOwn(packages, `${name}@${version}`)
    );
}

function isInvalidLockfile(error: unknown): boolean {
    if (error instanceof GspotError) return error.code === 'parse';
    return (
        error instanceof Error &&
        (['SyntaxError', 'YAMLParseError', 'YAMLException'].includes(error.name) ||
            error.message.startsWith('Expected an indexed object, got '))
    );
}

/**
Remove registry addresses from the portable lockfile of Bun.

@param lockfile the lockfile contents.
@param environment the configured registry addresses.
*/
export function stripBunRegistryUrls(lockfile: string, environment: Record<string, string>): string {
    const parsed = parseJsonFile(BUN_LOCKFILE, lockfile, bunLockfileSchema);
    let edited = lockfile;
    for (const [key, bunPackage] of Object.entries(parsed.packages)) {
        const npm = bunPackageSchema.safeParse(bunPackage);
        if (!npm.success || !isStandardBunTarball(npm.data, environment)) continue;
        edited = applyEdits(edited, modify(edited, ['packages', key, 1], '', {}));
    }
    return edited;
}

/**
Check whether a lockfile pins every generated dependency and no extra root dependency.

@param packageManager the package manager that wrote the lockfile.
@param lockfile the lockfile text.
@param dependencies what the tool project declares.
@param environment the configured package registry addresses, which each download must match when given.
*/
export function isLockfileFresh(
    packageManager: ToolPackageManagerName,
    lockfile: string,
    dependencies: Dependencies,
    environment?: Record<string, string>,
): boolean {
    try {
        const document = parseToolLockfile(packageManager, lockfile);
        if (!isDeepStrictEqual(parseRootDependencies(packageManager, document), dependencies)) return false;
        const validatePackages = {
            bun: hasStandardBunPackages,
            npm: hasStandardNpmPackages,
            pnpm: hasStandardPnpmPackages,
        };
        if (environment !== undefined && !validatePackages[packageManager](document, environment)) return false;
        return Object.entries(dependencies).every((pin) => isPinLocked(packageManager, document, pin));
    } catch (error) {
        if (isInvalidLockfile(error)) return false;
        throw error;
    }
}

/**
Select the lockfile name for the package manager of an npm tool project.

@param packageManager the validated name.
*/
export function selectLockfileName(packageManager: ToolPackageManagerName): ToolProjectLockfileName {
    return (
        LOCKFILES.filter((lockfile) => 'toolProject' in lockfile).find(
            (lockfile) => lockfile.packageManager === packageManager,
        ) as Extract<Lockfile, { toolProject: true }>
    ).file;
}
