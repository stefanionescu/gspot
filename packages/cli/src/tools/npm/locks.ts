// Matching and registry portability for private npm tool locks.
import semver from 'semver';
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { modify, applyEdits } from 'jsonc-parser';
import type { DependencyMap } from '#cli/types/parsers/packages.ts';
import type { LockName, BunPackage } from '#cli/types/parsers/lockfiles.ts';
import { HTTP_URL, INTEGRITY, CONFLICT_MARKER } from '#cli/config/tools/npm.ts';
import { parseLockfile, rootLockDependencies } from '#cli/parsers/lockfiles.ts';
import { yarnLockSchema, bunPackageSchema, bunPackagesSchema } from '#cli/parsers/schema/lockfiles.ts';

// Whether a Yarn lock resolves every dependency to its pinned version, under either descriptor form.
function yarnMatches(content: string, dependencies: DependencyMap): boolean {
    const entries = Object.entries(yarnLockSchema.parse(parseLockfile('yarn.lock', content)));
    return Object.entries(dependencies).every(([dependency, version]) =>
        entries.some(([descriptors, entry]) => {
            const requested = new Set(descriptors.split(/,\s*/u));
            const isPinned = requested.has(`${dependency}@${version}`) || requested.has(`${dependency}@npm:${version}`);
            return isPinned && entry.version === version;
        }),
    );
}

// The registry a package resolves through: its scope's, or the default one.
function registryFor(name: string, env: Record<string, string>): string | undefined {
    const scope = name.startsWith('@') ? name.split('/', 1)[0] : undefined;
    const scopeRegistry = scope === undefined ? undefined : env[`npm_config_${scope}:registry`];
    return scopeRegistry ?? env['npm_config_registry'];
}

// Whether a Bun lock entry resolved the standard tarball of a valid npm version through the configured registry.
function isStandardTarball(entry: BunPackage, env: Record<string, string>): boolean {
    const [identity, resolved, , integrity] = entry;
    const separator = identity.lastIndexOf('@');
    const name = identity.slice(0, separator);
    const version = identity.slice(separator + 1);
    if (semver.valid(version) === null || !INTEGRITY.test(integrity)) return false;
    const registry = registryFor(name, env);
    if (registry === undefined) return false;
    const base = registry.endsWith('/') ? registry : `${registry}/`;
    const filename = posix.basename(name);
    return resolved === new URL(`${name}/-/${filename}-${version}.tgz`, base).href;
}

// The registry-relative form of a resolved URL under the registry, or undefined when it lies elsewhere.
function relativeReference(resolved: string, base: URL): string | undefined {
    if (!HTTP_URL.test(resolved)) return undefined;
    const url = new URL(resolved);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return undefined;
    return `${url.pathname.slice(base.pathname.length)}${url.search}${url.hash}`;
}

/**
 * Whether a lock pins every generated dependency and carries no merge conflict.
 * npm, Bun, and pnpm must have no additional root dependencies; Yarn may retain extra entries.
 * @param name the package manager that wrote the lock
 * @param content the lock text
 * @param dependencies the dependencies the tool project declares
 * @returns true when the lock matches
 */
export function lockMatches(name: LockName, content: string, dependencies: DependencyMap): boolean {
    if (CONFLICT_MARKER.test(content)) return false;
    try {
        if (name === 'yarn') return yarnMatches(content, dependencies);
        return isDeepStrictEqual(rootLockDependencies(name, content), dependencies);
    } catch {
        return false;
    }
}

/**
 * Rewrite resolved URLs under the registry as relative paths, retaining Yarn's formatting.
 * Throw if any other entry changes.
 * @param content the lock text Yarn wrote
 * @param registry the registry URL its resolved references start with
 * @returns the lock text with registry-relative references
 */
export function stripYarnRegistryUrls(content: string, registry: string): string {
    const entries = yarnLockSchema.parse(parseLockfile('yarn.lock', content));
    const expected = structuredClone(entries);
    const base = new URL(registry.endsWith('/') ? registry : `${registry}/`);
    let edited = content;
    for (const entry of Object.values(expected)) {
        const relative = entry.resolved === undefined ? undefined : relativeReference(entry.resolved, base);
        if (relative === undefined) continue;
        edited = edited.replaceAll(JSON.stringify(entry.resolved), JSON.stringify(relative));
        entry.resolved = relative;
    }
    if (!isDeepStrictEqual(yarnLockSchema.parse(parseLockfile('yarn.lock', edited)), expected))
        throw new Error(
            'Cannot preserve Yarn lock entries while removing local registry routing. Existing files were preserved.',
        );
    return edited;
}

/**
 * Blank each standard registry tarball URL in the Bun lock.
 * Throw if any other entry changes.
 * @param content the lock text Bun wrote
 * @param env the registry settings the resolution ran with
 * @returns the lock text without the registry's tarball URLs
 */
export function stripBunRegistryUrls(content: string, env: Record<string, string>): string {
    const parsed = bunPackagesSchema.parse(parseLockfile('bun.lock', content));
    const expected = structuredClone(parsed);
    let edited = content;
    for (const [key, entry] of Object.entries(parsed.packages)) {
        const npm = bunPackageSchema.safeParse(entry);
        if (!npm.success || !isStandardTarball(npm.data, env)) continue;
        const copy = expected.packages[key];
        if (copy !== undefined) copy[1] = '';
        edited = applyEdits(edited, modify(edited, ['packages', key, 1], '', {}));
    }
    if (!isDeepStrictEqual(bunPackagesSchema.parse(parseLockfile('bun.lock', edited)), expected))
        throw new Error(
            'Cannot preserve Bun lock entries while removing registry routing. Existing files were preserved.',
        );
    return edited;
}
