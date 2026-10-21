// Check pinned dependencies and remove registry URLs from tool-project lockfiles.
import semver from 'semver';
import { posix } from 'node:path';
import { parseSyml } from '@yarnpkg/parsers';
import { isDeepStrictEqual } from 'node:util';
import { modify, applyEdits } from 'jsonc-parser';
import { GspotError } from '#cli/system/errors.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { parseYamlFile } from '#cli/parsers/yaml.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { isTable, getValueAt } from '#cli/system/tables.ts';
import type { BunPackage } from '#cli/types/install/npm.ts';
import { HTTP_URL } from '#cli/config/install/credentials.ts';
import type { YarnPackage } from '#cli/types/parsers/lockfiles.ts';
import { isYarnBerry } from '#cli/repository/npm/package-manager.ts';
import { PNPM_ROOT_IMPORTER } from '#cli/config/parsers/lockfiles.ts';
import { selectLockfileName } from '#cli/install/npm/tool-project.ts';
import type { DependencyMap } from '#cli/types/parsers/dependencies.ts';
import type { PackageManager } from '#cli/types/repository/package-manager.ts';
import { bunPackageSchema, npmToolLockSchemas } from '#cli/schemas/install/npm/lockfiles.ts';
import { bunLockSchema, yarnLockSchema, yarnPackageSchema } from '#cli/schemas/parsers/lockfiles.ts';

import {
    INTEGRITY,
    NPM_SETTING_PREFIX,
    LOCKFILE_WORKSPACE_KEYS,
    YARN_DESCRIPTOR_SEPARATOR,
} from '#cli/config/install/npm.ts';

// Check whether a parsed Yarn lockfile resolves each requested descriptor to its pinned version.
function isYarnLockfileCurrent(
    entries: Record<string, { version?: string | undefined }>,
    dependencies: DependencyMap,
): boolean {
    return Object.entries(dependencies).every(([dependency, version]) =>
        Object.entries(entries).some(([descriptors, entry]) => {
            const requested = new Set(descriptors.split(YARN_DESCRIPTOR_SEPARATOR));
            return (
                (requested.has(`${dependency}@${version}`) || requested.has(`${dependency}@npm:${version}`)) &&
                entry.version === version
            );
        }),
    );
}

// Find the registry of a package: the registry of its scope, or the default.
function findPackageRegistry(name: string, env: Record<string, string>): string | undefined {
    const scope = name.startsWith('@') ? name.split('/', 1)[0] : undefined;
    const scopeRegistry = scope === undefined ? undefined : env[`${NPM_SETTING_PREFIX}${scope}:registry`];
    return scopeRegistry ?? env[`${NPM_SETTING_PREFIX}registry`];
}

// Check whether a Bun lockfile entry resolved the standard tarball of a valid npm version through the configured registry.
function isStandardTarball(entry: BunPackage, env: Record<string, string>): boolean {
    const [identity, address, , integrity] = entry;
    const separator = identity.lastIndexOf('@');
    const name = identity.slice(0, separator);
    const version = identity.slice(separator + 1);
    if (semver.valid(version) === null || !INTEGRITY.test(integrity)) return false;
    const registry = findPackageRegistry(name, env);
    if (registry === undefined) return false;
    const base = registry.endsWith('/') ? registry : `${registry}/`;
    const filename = posix.basename(name);
    return address === new URL(`${name}/-/${filename}-${version}.tgz`, base).href;
}

// Strip the registry prefix from a resolved URL, or return undefined when the URL lies elsewhere.
function stripRegistryPrefix(address: string, base: URL): string | undefined {
    if (!HTTP_URL.test(address)) return undefined;
    const url = new URL(address);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return undefined;
    return `${url.pathname.slice(base.pathname.length)}${url.search}${url.hash}`;
}

/**
 * Rewrite resolved URLs under the registry as relative paths, and keep the Yarn formatting.
 * Throw if any other entry changes.
 *
 * @param content the lockfile text Yarn wrote.
 * @param registry the URL that resolved references start with.
 *
 * @returns the lockfile text with registry-relative references.
 */
function stripYarnRegistryUrls(content: string, registry: string): string {
    const entries = yarnLockSchema.parse(parseSyml(content));
    const expected = Object.fromEntries(
        Object.entries(entries).map(([key, entry]) => [key, yarnPackageSchema.parse(entry)]),
    );
    const base = new URL(registry.endsWith('/') ? registry : `${registry}/`);
    let edited = content;
    for (const entry of Object.values(expected)) {
        const relative = entry.resolved === undefined ? undefined : stripRegistryPrefix(entry.resolved, base);
        if (relative === undefined) continue;
        edited = edited.replaceAll(JSON.stringify(entry.resolved), JSON.stringify(relative));
        entry.resolved = relative;
    }
    if (!isDeepStrictEqual(yarnLockSchema.parse(parseSyml(edited)), expected))
        throw new GspotError(
            'install',
            'Cannot preserve Yarn lockfile entries while removing local registry routing. Existing files were preserved.',
        );
    return edited;
}

/**
 * Blank each standard registry tarball URL through a targeted JSON edit.
 *
 * @param content the lockfile text Bun wrote.
 * @param env the registry settings the resolution ran with.
 *
 * @returns the lockfile text without the registry tarball URLs.
 */
function stripBunRegistryUrls(content: string, env: Record<string, string>): string {
    const parsed = parseJsonFile('bun.lock', content, bunLockSchema);
    let edited = content;
    for (const [key, entry] of Object.entries(parsed.packages)) {
        const npm = bunPackageSchema.safeParse(entry);
        if (!npm.success || !isStandardTarball(npm.data, env)) continue;
        edited = applyEdits(edited, modify(edited, ['packages', key, 1], '', {}));
    }
    return edited;
}

// Validate the tool project's development pins over the shared loose lockfile shape.
function parseDevelopmentDependencies(
    name: Exclude<PackageManager['name'], 'yarn'>,
    entry: unknown,
): DependencyMap | undefined {
    if (!isTable(entry)) return undefined;
    const dependencies = entry['devDependencies'];
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

// Select the workspace entries after validating the package manager's lockfile shape.
function parseWorkspaceEntries(
    name: Exclude<PackageManager['name'], 'yarn'>,
    content: string,
): Record<string, unknown> | undefined {
    const path = selectLockfileName(name);
    const schema = npmToolLockSchemas[name];
    const document =
        name === 'pnpm'
            ? parseYamlFile<Record<string, unknown>>(path, content, schema)
            : parseJsonFile<Record<string, unknown>>(path, content, schema);
    const entries = document[LOCKFILE_WORKSPACE_KEYS[name]];
    return isTable(entries) ? entries : undefined;
}

// Require valid package entries before checking Yarn's requested descriptors.
function parseYarnEntries(content: string): Record<string, YarnPackage> | undefined {
    const parsed = yarnLockSchema.safeParse(parseSyml(content));
    if (!parsed.success) return undefined;
    const entries = Object.entries(parsed.data).map(
        ([key, entry]) => [key, yarnPackageSchema.safeParse(entry)] as const,
    );
    if (entries.some(([, entry]) => !entry.success)) return undefined;
    return Object.fromEntries(entries.flatMap(([key, entry]) => (entry.success ? [[key, entry.data]] : [])));
}

/**
 * Read the root dependencies of a lockfile.
 *
 * @param name the package manager that wrote the lockfile.
 * @param content the lockfile text.
 *
 * @returns the dependencies recorded for the root project.
 */
function parseRootDependencies(
    name: Exclude<PackageManager['name'], 'yarn'>,
    content: string,
): DependencyMap | undefined {
    const entries = parseWorkspaceEntries(name, content);
    if (entries === undefined) return undefined;
    let root: DependencyMap = {};
    for (const [key, entry] of Object.entries(entries)) {
        const dependencies = parseDevelopmentDependencies(name, entry);
        if (dependencies === undefined) return undefined;
        if (key === (name === 'pnpm' ? PNPM_ROOT_IMPORTER : '')) root = dependencies;
    }
    return root;
}

// Treat malformed stored lockfiles as stale, while preserving unrelated process failures.
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
 *
 * @returns true when the lockfile matches.
 */
export function isLockfileCurrent(name: PackageManager['name'], content: string, dependencies: DependencyMap): boolean {
    try {
        if (name === 'yarn') {
            const entries = parseYarnEntries(content);
            return entries !== undefined && isYarnLockfileCurrent(entries, dependencies);
        }
        const parsed = parseRootDependencies(name, content);
        return parsed !== undefined && isDeepStrictEqual(parsed, dependencies);
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
