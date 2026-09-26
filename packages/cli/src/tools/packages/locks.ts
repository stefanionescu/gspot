// Reading each package manager's lock: whether it pins the generated dependencies, and how registry routing is removed.
import { z } from 'zod';
import semver from 'semver';
import { parse as parseYaml } from 'yaml';
import { parseSyml } from '@yarnpkg/parsers';
import { isDeepStrictEqual } from 'node:util';
import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser';
import type { BunPackage, Dependencies, LockName } from '#cli/types/tools/packages.ts';

const CONFLICT_MARKER = /^(?:<{7}|={7}|>{7})/mu;
const HTTP_URL = /^https?:\/\//u;
const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u;
const DEV_DEPENDENCIES = z.object({ devDependencies: z.record(z.string(), z.string()).optional() });
const NPM_LOCK = z.object({ packages: z.record(z.string(), DEV_DEPENDENCIES) });
const BUN_LOCK = z.object({ workspaces: z.record(z.string(), DEV_DEPENDENCIES) });
const PNPM_LOCK = z.object({ importers: z.record(z.string(), z.object({ devDependencies: z.unknown() })) });
const PNPM_SPECIFIERS = z.record(z.string(), z.object({ specifier: z.string() }));
const YARN_LOCK = z.record(
    z.string(),
    z.looseObject({ version: z.string().optional(), resolved: z.string().optional() }),
);
const BUN_LOCK_PACKAGES = z.looseObject({ packages: z.record(z.string(), z.array(z.unknown())) });
const BUN_PACKAGE = z.tuple([z.string(), z.string(), z.record(z.string(), z.unknown()), z.string()]);

// The root dev dependencies an npm lock records.
function npmDependencies(content: string): unknown {
    return NPM_LOCK.parse(JSON.parse(content)).packages['']?.devDependencies;
}

// The root dev dependencies a Bun lock records.
function bunDependencies(content: string): unknown {
    return BUN_LOCK.parse(parseJsonc(content)).workspaces['']?.devDependencies;
}

// The root dev dependencies a pnpm lock records, each as the specifier it was requested with.
function pnpmDependencies(content: string): unknown {
    const pinned = PNPM_LOCK.parse(parseYaml(content)).importers['.']?.devDependencies;
    const entries = PNPM_SPECIFIERS.parse(pinned);
    return Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, value.specifier]));
}

// Whether a Yarn lock resolves every dependency to its pinned version, under either descriptor form.
function yarnMatches(content: string, dependencies: Dependencies): boolean {
    const entries = Object.entries(YARN_LOCK.parse(parseSyml(content)));
    return Object.entries(dependencies).every(([dependency, version]) =>
        entries.some(([descriptors, entry]) => {
            const requested = new Set(descriptors.split(/,\s*/u));
            const isPinned = requested.has(`${dependency}@${version}`) || requested.has(`${dependency}@npm:${version}`);
            return isPinned && entry.version === version;
        }),
    );
}

const ROOT_DEPENDENCIES: Record<Exclude<LockName, 'yarn'>, (content: string) => unknown> = {
    npm: npmDependencies,
    bun: bunDependencies,
    pnpm: pnpmDependencies,
};

// The name and version of a Bun lock package identity such as `name@1.2.3`.
function bunIdentity(identity: string): { name: string; version: string } {
    const separator = identity.lastIndexOf('@');
    return { name: identity.slice(0, separator), version: identity.slice(separator + 1) };
}

// The registry a package resolves through: its scope's, or the default one.
function registryFor(name: string, env: Record<string, string>): string | undefined {
    const scope = name.startsWith('@') ? name.split('/', 1)[0] : undefined;
    const scoped = scope === undefined ? undefined : env[`npm_config_${scope}:registry`];
    return scoped ?? env['npm_config_registry'];
}

// Whether a Bun lock entry resolved the standard tarball of a valid npm version through the configured registry.
function isStandardTarball(entry: BunPackage, env: Record<string, string>): boolean {
    const [identity, resolved, , integrity] = entry;
    const { name, version } = bunIdentity(identity);
    if (semver.valid(version) === null || !INTEGRITY.test(integrity)) return false;
    const registry = registryFor(name, env);
    if (registry === undefined) return false;
    const base = registry.endsWith('/') ? registry : `${registry}/`;
    const filename = name.slice(name.lastIndexOf('/') + 1);
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
 * Whether a lock pins exactly the generated dependencies and carries no merge conflict.
 * @param name the package manager that wrote the lock
 * @param content the lock text
 * @param dependencies the dependencies the tool project declares
 * @returns true when the lock matches
 */
export function lockMatches(name: LockName, content: string, dependencies: Dependencies): boolean {
    if (CONFLICT_MARKER.test(content)) return false;
    try {
        if (name === 'yarn') return yarnMatches(content, dependencies);
        return isDeepStrictEqual(ROOT_DEPENDENCIES[name](content) ?? {}, dependencies);
    } catch {
        return false;
    }
}

/**
 * Yarn Classic accepts registry-relative tarball references; retain its own serialization and validate each edit.
 * @param content the lock text Yarn wrote
 * @param registry the registry URL its resolved references start with
 * @returns the lock text with registry-relative references
 */
export function relativeYarnLock(content: string, registry: string): string {
    const entries = YARN_LOCK.parse(parseSyml(content));
    const expected = structuredClone(entries);
    const base = new URL(registry.endsWith('/') ? registry : `${registry}/`);
    let edited = content;
    for (const entry of Object.values(expected)) {
        const relative = entry.resolved === undefined ? undefined : relativeReference(entry.resolved, base);
        if (relative === undefined) continue;
        edited = edited.replaceAll(JSON.stringify(entry.resolved), JSON.stringify(relative));
        entry.resolved = relative;
    }
    if (!isDeepStrictEqual(YARN_LOCK.parse(parseSyml(edited)), expected))
        throw new Error(
            'Cannot preserve Yarn lock entries while removing local registry routing. Existing files were preserved.',
        );
    return edited;
}

/**
 * Keep native npm package identities and integrity while resolving standard tarballs through local registry settings.
 * @param content the lock text Bun wrote
 * @param env the registry settings the resolution ran with
 * @returns the lock text without the registry's tarball URLs
 */
export function portableBunLock(content: string, env: Record<string, string>): string {
    const parsed = BUN_LOCK_PACKAGES.parse(parseJsonc(content));
    const expected = structuredClone(parsed);
    let edited = content;
    for (const [key, entry] of Object.entries(parsed.packages)) {
        const npm = BUN_PACKAGE.safeParse(entry);
        if (!npm.success || !isStandardTarball(npm.data, env)) continue;
        const copy = expected.packages[key];
        if (copy !== undefined) copy[1] = '';
        edited = applyEdits(edited, modify(edited, ['packages', key, 1], '', {}));
    }
    if (!isDeepStrictEqual(BUN_LOCK_PACKAGES.parse(parseJsonc(edited)), expected))
        throw new Error(
            'Cannot preserve Bun lock entries while removing registry routing. Existing files were preserved.',
        );
    return edited;
}
