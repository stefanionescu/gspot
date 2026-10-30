import semver from 'semver';
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { modify, applyEdits } from 'jsonc-parser';
import { GspotError } from '#cli/system/errors.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import { NPM_PACKAGE_FOLDER } from '#cli/config/files/names.ts';
import { splitIdentity } from '#cli/parsers/projects/lockfiles.ts';
import { type Dependencies } from '#cli/types/parsers/projects.ts';
import { type PackageManager } from '#cli/types/repository/npm.ts';
import { bunLockfileSchema } from '#cli/schemas/parsers/projects.ts';
import { PNPM_PEER_START, PNPM_ROOT_IMPORTER } from '#cli/config/parsers/projects.ts';
import { INTEGRITY, BUN_LOCKFILE, NPM_SETTING_PREFIX, LOCKFILE_WORKSPACE_KEYS } from '#cli/config/installers/npm.ts';

import {
    type Lockfile,
    type BunPackage,
    type LockedTarball,
    type ToolProjectLockfileName,
} from '#cli/types/installers/npm.ts';
import {
    bunPackageSchema,
    npmToolLockSchemas,
    npmToolPackageSchema,
    pnpmToolPackageSchema,
} from '#cli/schemas/installers/npm.ts';

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

function parseDevelopmentDependencies(
    packageManager: Exclude<PackageManager['name'], 'yarn'>,
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

function parseToolLockfile(
    packageManager: Exclude<PackageManager['name'], 'yarn'>,
    lockfile: string,
): Record<string, unknown> {
    const path = selectLockfileName(packageManager);
    const schema = npmToolLockSchemas[packageManager];
    return packageManager === 'pnpm'
        ? parseYamlFile<Record<string, unknown>>(path, lockfile, schema)
        : parseJsonFile<Record<string, unknown>>(path, lockfile, schema);
}

function parseRootDependencies(
    packageManager: Exclude<PackageManager['name'], 'yarn'>,
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

function isBunLockfileFresh(
    document: Record<string, unknown>,
    dependencies: Dependencies,
    environment: Record<string, string>,
): boolean {
    const packages = document['packages'] as Record<string, unknown[]>;
    for (const [key, value] of Object.entries(packages)) {
        const parsed = bunPackageSchema.safeParse(value);
        if (!parsed.success) return false;
        const identity = splitIdentity(parsed.data[0]);
        if (identity?.[0] !== getBunPackageName(key) || !isStandardBunTarball(parsed.data, environment)) return false;
    }
    return Object.entries(dependencies).every(([name, version]) => packages[name]?.[0] === `${name}@${version}`);
}

function isNpmLockfileFresh(
    document: Record<string, unknown>,
    dependencies: Dependencies,
    environment: Record<string, string>,
): boolean {
    const packages = document['packages'] as Record<string, Record<string, unknown>>;
    const matches = Object.entries(packages).every(([key, lockedPackage]) => {
        if (!key.includes(NPM_PACKAGE_FOLDER)) return true;
        const name = key.slice(key.lastIndexOf(NPM_PACKAGE_FOLDER) + NPM_PACKAGE_FOLDER.length);
        const parsed = npmToolPackageSchema.safeParse(lockedPackage);
        if (!parsed.success) return false;
        const { version, resolved = '', integrity, name: identity = name } = parsed.data;
        return identity === name && isStandardTarball({ name, version, address: resolved, integrity }, environment);
    });
    return (
        matches &&
        Object.entries(dependencies).every(
            ([name, version]) => packages[`${NPM_PACKAGE_FOLDER}${name}`]?.['version'] === version,
        )
    );
}

function isPnpmLockfileFresh(
    document: Record<string, unknown>,
    dependencies: Dependencies,
    environment: Record<string, string>,
): boolean {
    const packages = document['packages'] as Record<string, unknown>;
    const matches = Object.entries(packages).every(([key, lockedPackage]) => {
        const identity = splitIdentity((key.startsWith('/') ? key.slice(1) : key).split(PNPM_PEER_START, 1).join(''));
        const parsed = pnpmToolPackageSchema.safeParse(lockedPackage);
        if (identity === undefined || !parsed.success) return false;
        const [name, version] = identity;
        const {
            name: installed = name,
            resolution: { tarball = '', integrity },
        } = parsed.data;
        return installed === name && isStandardTarball({ name, version, address: tarball, integrity }, environment);
    });
    return (
        matches &&
        Object.entries(dependencies).every(([name, pin]) => {
            const version = findValueAt(document, [
                'importers',
                PNPM_ROOT_IMPORTER,
                'devDependencies',
                name,
                'version',
            ]);
            return (
                typeof version === 'string' &&
                version.split(PNPM_PEER_START, 1)[0] === pin &&
                Object.hasOwn(packages, `${name}@${pin}`)
            );
        })
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
Check whether a lockfile pins every generated dependency and no extra root dependency.

@param packageManager the package manager that wrote the lockfile.
@param lockfile the lockfile text.
@param dependencies what the tool project declares.
@param environment the configured package registry addresses.
*/
export function isLockfileFresh(
    packageManager: Exclude<PackageManager['name'], 'yarn'>,
    lockfile: string,
    dependencies: Dependencies,
    environment: Record<string, string>,
): boolean {
    try {
        const document = parseToolLockfile(packageManager, lockfile);
        if (!isDeepStrictEqual(parseRootDependencies(packageManager, document), dependencies)) return false;
        const validatePackages = { bun: isBunLockfileFresh, npm: isNpmLockfileFresh, pnpm: isPnpmLockfileFresh };
        return validatePackages[packageManager](document, dependencies, environment);
    } catch (error) {
        if (isInvalidLockfile(error)) return false;
        throw error;
    }
}

/**
Select the lockfile name for the package manager of an npm tool project.

@param packageManager the validated name.
*/
export function selectLockfileName(packageManager: Exclude<PackageManager['name'], 'yarn'>): ToolProjectLockfileName {
    return (
        LOCKFILES.filter((lockfile) => 'toolProject' in lockfile).find(
            (lockfile) => lockfile.packageManager === packageManager,
        ) as Extract<Lockfile, { toolProject: true }>
    ).file;
}
