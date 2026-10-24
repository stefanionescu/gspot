import semver from 'semver';
import { posix } from 'node:path';
import { parseSyml } from '@yarnpkg/parsers';
import { isDeepStrictEqual } from 'node:util';
import { modify, applyEdits } from 'jsonc-parser';
import { GspotError } from '#cli/system/errors.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { isTable, getValueAt } from '#cli/system/tables.ts';
import type { BunPackage } from '#cli/types/install/npm.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { splitIdentity } from '#cli/parsers/projects/lockfiles.ts';
import { isYarnBerry } from '#cli/repository/npm/package-manager.ts';
import { selectLockfileName } from '#cli/install/npm/package-json.ts';
import { NPM_SETTING_PREFIX } from '#cli/config/install/npm/project.ts';
import type { YarnPackage } from '#cli/types/parsers/projects/lockfiles.ts';
import type { DependencyMap } from '#cli/types/parsers/projects/dependencies.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';
import { bunLockSchema, yarnLockSchema, yarnPackageSchema } from '#cli/schemas/parsers/projects/lockfiles.ts';
import { PNPM_PEER_START, PNPM_ROOT_IMPORTER, NPM_PACKAGE_FOLDER } from '#cli/config/parsers/projects/lockfiles.ts';

import {
    HTTP_URL,
    INTEGRITY,
    LOCKFILE_WORKSPACE_KEYS,
    YARN_DESCRIPTOR_SEPARATOR,
} from '#cli/config/install/npm/lockfiles.ts';
import {
    bunPackageSchema,
    npmToolLockSchemas,
    npmToolPackageSchema,
    pnpmToolPackageSchema,
} from '#cli/schemas/install/npm/lockfiles.ts';

function isYarnLockfileFresh(
    yarnPackages: Record<string, { version?: string | undefined }>,
    dependencies: DependencyMap,
): boolean {
    return Object.entries(dependencies).every(([dependency, version]) =>
        Object.entries(yarnPackages).some(([descriptors, yarnPackage]) => {
            const requested = new Set(descriptors.split(YARN_DESCRIPTOR_SEPARATOR));
            return (
                (requested.has(`${dependency}@${version}`) || requested.has(`${dependency}@npm:${version}`)) &&
                yarnPackage.version === version
            );
        }),
    );
}

function findPackageRegistry(name: string, env: Record<string, string>): string | undefined {
    const scope = name.startsWith('@') ? name.split('/', 1)[0] : undefined;
    const scopeRegistry = scope === undefined ? undefined : env[`${NPM_SETTING_PREFIX}${scope}:registry`];
    return scopeRegistry ?? env[`${NPM_SETTING_PREFIX}registry`];
}

function isStandardTarball(bunPackage: BunPackage, env: Record<string, string>): boolean {
    const [identity, address, , integrity] = bunPackage;
    const separator = identity.lastIndexOf('@');
    const name = identity.slice(0, separator);
    const version = identity.slice(separator + 1);
    if (semver.valid(version) === null || !INTEGRITY.test(integrity)) return false;
    const registry = findPackageRegistry(name, env);
    if (registry === undefined) return false;
    const base = registry.endsWith('/') ? registry : `${registry}/`;
    const filename = posix.basename(name);
    return address === '' || address === new URL(`${name}/-/${filename}-${version}.tgz`, base).href;
}

function stripRegistryPrefix(address: string, base: URL): string | undefined {
    if (!HTTP_URL.test(address)) return undefined;
    const url = new URL(address);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return undefined;
    return `${url.pathname.slice(base.pathname.length)}${url.search}${url.hash}`;
}

function stripYarnRegistryUrls(content: string, registry: string): string {
    const yarnPackages = yarnLockSchema.parse(parseSyml(content));
    const expected = Object.fromEntries(
        Object.entries(yarnPackages).map(([key, yarnPackage]) => [key, yarnPackageSchema.parse(yarnPackage)]),
    );
    const base = new URL(registry.endsWith('/') ? registry : `${registry}/`);
    let edited = content;
    for (const yarnPackage of Object.values(expected)) {
        const relative =
            yarnPackage.resolved === undefined ? undefined : stripRegistryPrefix(yarnPackage.resolved, base);
        if (relative === undefined) continue;
        edited = edited.replaceAll(JSON.stringify(yarnPackage.resolved), JSON.stringify(relative));
        yarnPackage.resolved = relative;
    }
    if (!isDeepStrictEqual(yarnLockSchema.parse(parseSyml(edited)), expected))
        throw new GspotError(
            'install',
            'gspot cannot take the local registry addresses out of the Yarn lockfile without changing its entries. gspot kept the existing files.',
        );
    return edited;
}

function stripBunRegistryUrls(content: string, env: Record<string, string>): string {
    const parsed = parseJsonFile('bun.lock', content, bunLockSchema);
    let edited = content;
    for (const [key, bunPackage] of Object.entries(parsed.packages)) {
        const npm = bunPackageSchema.safeParse(bunPackage);
        if (!npm.success || !isStandardTarball(npm.data, env)) continue;
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

function parseYarnPackages(content: string): Record<string, YarnPackage> | undefined {
    const parsed = yarnLockSchema.safeParse(parseSyml(content));
    if (!parsed.success) return undefined;
    const yarnPackages = Object.entries(parsed.data).map(
        ([key, result]) => [key, yarnPackageSchema.safeParse(result)] as const,
    );
    if (yarnPackages.some(([, result]) => !result.success)) return undefined;
    return Object.fromEntries(yarnPackages.flatMap(([key, result]) => (result.success ? [[key, result.data]] : [])));
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
        if (identity?.[0] !== getBunPackageName(key) || !isStandardTarball(parsed.data, env)) return false;
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
        return identity === name && isStandardTarball([`${name}@${version}`, resolved, {}, integrity], env);
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
        return installed === name && isStandardTarball([`${name}@${version}`, tarball, {}, integrity], env);
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
 * Check whether a lockfile pins every generated dependency.
 * npm, Bun, and pnpm must have no extra root dependencies; Yarn may keep extra entries.
 *
 * @param name the package manager that wrote the lockfile.
 * @param content the lockfile text.
 * @param dependencies what the tool project declares.
 * @param env the configured package registry addresses.
 *
 * @returns true when the lockfile matches.
 */
export function isLockfileFresh(
    name: PackageManager['name'],
    content: string,
    dependencies: DependencyMap,
    env: Record<string, string>,
): boolean {
    try {
        if (name === 'yarn') {
            const yarnPackages = parseYarnPackages(content);
            return yarnPackages !== undefined && isYarnLockfileFresh(yarnPackages, dependencies);
        }
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
 * Remove registry locations from portable lockfile bytes.
 *
 * @param lockfilePath the portable lockfile to read and rewrite.
 * @param packageManager the tool that wrote the lockfile.
 * @param env variables for the tool process.
 */
export function stripRegistryUrls(
    lockfilePath: string,
    packageManager: PackageManager,
    env: Record<string, string>,
): void {
    const lockfile = readFileSync(lockfilePath, 'utf8');
    if (packageManager.name === 'bun') writeFileSync(lockfilePath, stripBunRegistryUrls(lockfile, env));
    if (packageManager.name !== 'yarn' || isYarnBerry(packageManager)) return;
    const registry = env[`${NPM_SETTING_PREFIX}registry`];
    if (registry === undefined)
        throw new GspotError('install', 'A Yarn 1 lockfile needs npm_config_registry to relocate its URLs.');
    writeFileSync(lockfilePath, stripYarnRegistryUrls(lockfile, registry));
}
