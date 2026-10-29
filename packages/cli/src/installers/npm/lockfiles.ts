import semver from 'semver';
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { modify, applyEdits } from 'jsonc-parser';
import { GspotError } from '#cli/system/errors.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import { isTable, getValueAt } from '#cli/system/tables.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { NPM_PACKAGE_FOLDER } from '#cli/config/files/names.ts';
import { splitIdentity } from '#cli/parsers/projects/lockfiles.ts';
import { NPM_SETTING_PREFIX } from '#cli/config/installers/npm/project.ts';
import { bunLockSchema } from '#cli/schemas/parsers/projects/lockfiles.ts';
import type { BunPackage, LockedTarball } from '#cli/types/installers/npm.ts';
import type { DependencyMap } from '#cli/types/parsers/projects/dependencies.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';
import { INTEGRITY, LOCKFILE_WORKSPACE_KEYS } from '#cli/config/installers/npm/lockfiles.ts';
import { PNPM_PEER_START, PNPM_ROOT_IMPORTER } from '#cli/config/parsers/projects/lockfiles.ts';
import type { Lockfile, ToolProjectLockfileName } from '#cli/types/parsers/projects/lockfiles.ts';

import {
    bunPackageSchema,
    npmToolLockSchemas,
    npmToolPackageSchema,
    pnpmToolPackageSchema,
} from '#cli/schemas/installers/npm.ts';

function findPackageRegistry(name: string, env: Record<string, string>): string | undefined {
    const scope = name.startsWith('@') ? name.split('/', 1)[0] : undefined;
    const scopeRegistry = scope === undefined ? undefined : env[`${NPM_SETTING_PREFIX}${scope}:registry`];
    return scopeRegistry ?? env[`${NPM_SETTING_PREFIX}registry`];
}

function isStandardTarball(tarball: LockedTarball, env: Record<string, string>): boolean {
    const { name, version, address, integrity } = tarball;
    if (semver.valid(version) === null || !INTEGRITY.test(integrity)) return false;
    const registry = findPackageRegistry(name, env);
    if (registry === undefined) return false;
    const base = registry.endsWith('/') ? registry : `${registry}/`;
    const filename = posix.basename(name);
    return address === '' || address === new URL(`${name}/-/${filename}-${version}.tgz`, base).href;
}

function isStandardBunTarball(bunPackage: BunPackage, env: Record<string, string>): boolean {
    const [identity, address, , integrity] = bunPackage;
    const separator = identity.lastIndexOf('@');
    const name = identity.slice(0, separator);
    const version = identity.slice(separator + 1);
    return isStandardTarball({ name, version, address, integrity }, env);
}

/**
Remove registry addresses from the portable lockfile of Bun.

@param content the lockfile contents.
@param env the configured registry addresses.
@returns the portable lockfile contents.
*/
export function stripBunRegistryUrls(content: string, env: Record<string, string>): string {
    const parsed = parseJsonFile('bun.lock', content, bunLockSchema);
    let edited = content;
    for (const [key, bunPackage] of Object.entries(parsed.packages)) {
        const npm = bunPackageSchema.safeParse(bunPackage);
        if (!npm.success || !isStandardBunTarball(npm.data, env)) continue;
        edited = applyEdits(edited, modify(edited, ['packages', key, 1], '', {}));
    }
    return edited;
}

function parseDevelopmentDependencies(
    name: Exclude<PackageManager['name'], 'yarn'>,
    workspace: unknown,
): DependencyMap | undefined {
    if (!isTable(workspace)) return undefined;
    const dependencies = workspace['devDependencies'];
    if (dependencies === undefined) return {};
    if (!isTable(dependencies)) return undefined;
    const pins: DependencyMap = {};
    for (const [dependency, value] of Object.entries(dependencies)) {
        const specifier = name === 'pnpm' ? getValueAt(value, ['specifier']) : value;
        if (typeof specifier !== 'string') return undefined;
        pins[dependency] = specifier;
    }
    return pins;
}

function parseToolLockfile(name: Exclude<PackageManager['name'], 'yarn'>, content: string): Record<string, unknown> {
    const path = selectLockfileName(name);
    const schema = npmToolLockSchemas[name];
    return name === 'pnpm'
        ? parseYamlFile<Record<string, unknown>>(path, content, schema)
        : parseJsonFile<Record<string, unknown>>(path, content, schema);
}

function parseRootDependencies(
    name: Exclude<PackageManager['name'], 'yarn'>,
    document: Record<string, unknown>,
): DependencyMap | undefined {
    const workspaces = document[LOCKFILE_WORKSPACE_KEYS[name]];
    if (!isTable(workspaces)) return undefined;
    let root: DependencyMap = {};
    for (const [key, workspace] of Object.entries(workspaces)) {
        const dependencies = parseDevelopmentDependencies(name, workspace);
        if (dependencies === undefined) return undefined;
        if (key === (name === 'pnpm' ? PNPM_ROOT_IMPORTER : '')) root = dependencies;
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
    dependencies: DependencyMap,
    env: Record<string, string>,
): boolean {
    const packages = document['packages'] as Record<string, unknown[]>;
    for (const [key, value] of Object.entries(packages)) {
        const parsed = bunPackageSchema.safeParse(value);
        if (!parsed.success) return false;
        const identity = splitIdentity(parsed.data[0]);
        if (identity?.[0] !== getBunPackageName(key) || !isStandardBunTarball(parsed.data, env)) return false;
    }
    return Object.entries(dependencies).every(([name, version]) => packages[name]?.[0] === `${name}@${version}`);
}

function isNpmLockfileFresh(
    document: Record<string, unknown>,
    dependencies: DependencyMap,
    env: Record<string, string>,
): boolean {
    const packages = document['packages'] as Record<string, Record<string, unknown>>;
    const matches = Object.entries(packages).every(([key, lockedPackage]) => {
        if (!key.includes(NPM_PACKAGE_FOLDER)) return true;
        const name = key.slice(key.lastIndexOf(NPM_PACKAGE_FOLDER) + NPM_PACKAGE_FOLDER.length);
        const parsed = npmToolPackageSchema.safeParse(lockedPackage);
        if (!parsed.success) return false;
        const { version, resolved = '', integrity, name: identity = name } = parsed.data;
        return identity === name && isStandardTarball({ name, version, address: resolved, integrity }, env);
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
    dependencies: DependencyMap,
    env: Record<string, string>,
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
        return installed === name && isStandardTarball({ name, version, address: tarball, integrity }, env);
    });
    return (
        matches &&
        Object.entries(dependencies).every(([name, pin]) => {
            const version = getValueAt(document, ['importers', PNPM_ROOT_IMPORTER, 'devDependencies', name, 'version']);
            return (
                typeof version === 'string' &&
                version.split(PNPM_PEER_START, 1)[0] === pin &&
                Object.hasOwn(packages, `${name}@${pin}`)
            );
        })
    );
}

function isInvalidLockfile(error: unknown): boolean {
    if (error instanceof GspotError) return error.code === 'filesystem';
    return (
        error instanceof Error &&
        (['SyntaxError', 'YAMLParseError', 'YAMLException'].includes(error.name) ||
            error.message.startsWith('Expected an indexed object, got '))
    );
}

/**
Check whether a lockfile pins every generated dependency.
The root dependencies must match the generated tool project exactly.

@param name the package manager that wrote the lockfile.
@param content the lockfile text.
@param dependencies what the tool project declares.
@param env the configured package registry addresses.

@returns true when the lockfile matches.
*/
export function isLockfileFresh(
    name: Exclude<PackageManager['name'], 'yarn'>,
    content: string,
    dependencies: DependencyMap,
    env: Record<string, string>,
): boolean {
    try {
        const document = parseToolLockfile(name, content);
        if (!isDeepStrictEqual(parseRootDependencies(name, document), dependencies)) return false;
        const validatePackages = { bun: isBunLockfileFresh, npm: isNpmLockfileFresh, pnpm: isPnpmLockfileFresh };
        return validatePackages[name](document, dependencies, env);
    } catch (error) {
        if (isInvalidLockfile(error)) return false;
        throw error;
    }
}

/**
Select the lockfile name for the package manager of an npm tool project.

@param packageManager the validated name.
@returns the lockfile basename that LOCKFILES declares.
*/
export function selectLockfileName(packageManager: Exclude<PackageManager['name'], 'yarn'>): ToolProjectLockfileName {
    return (
        LOCKFILES.filter((lockfile) => 'toolProject' in lockfile).find(
            (lockfile) => lockfile.packageManager === packageManager,
        ) as Extract<Lockfile, { toolProject: true }>
    ).file;
}
