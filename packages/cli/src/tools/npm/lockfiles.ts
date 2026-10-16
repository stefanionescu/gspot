// Shapes read from dependency lockfiles before their values reach consumers.
// Matching and registry portability for npm tool-project lockfiles.
// Shapes read from dependency lockfiles before their values reach consumers.
// Matching and registry portability for npm tool-project lockfiles.
import { z } from 'zod';
import semver from 'semver';
import { writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseSyml } from '@yarnpkg/parsers';
import { isDeepStrictEqual } from 'node:util';
import { parseJsonc } from '#cli/parsers/json.ts';
import { modify, applyEdits } from 'jsonc-parser';
import { GspotError } from '#cli/system/errors.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { HTTP_URL } from '#cli/config/tools/diagnostics.ts';
import { isYarnBerry } from '#cli/tools/npm/package-manager.ts';
import { selectLockfileName } from '#cli/tools/npm/tool-project.ts';
import { PNPM_ROOT_IMPORTER } from '#cli/config/parsers/lockfiles.ts';
import type { BunPackage, PackageCommandResult } from '#cli/types/tools/project.ts';
import type { DependencyMap, PackageManager } from '#cli/types/parsers/dependency-files.ts';
import { INTEGRITY, NPM_SETTING_PREFIX, YARN_DESCRIPTOR_SEPARATOR } from '#cli/config/tools/npm.ts';

const devDependenciesSchema = z.object({
    devDependencies: z.record(z.string(), z.string()).optional(),
} satisfies SchemaShape<{ devDependencies?: Record<string, string> | undefined }>);

const npmLockfileSchema = z.object({ packages: z.record(z.string(), devDependenciesSchema) } satisfies SchemaShape<{
    packages: Record<string, { devDependencies?: Record<string, string> | undefined }>;
}>);

const bunLockfileSchema = z.object({ workspaces: z.record(z.string(), devDependenciesSchema) } satisfies SchemaShape<{
    workspaces: Record<string, { devDependencies?: Record<string, string> | undefined }>;
}>);

const pnpmLockfileSchema = z.object({
    importers: z.record(
        z.string(),
        z.object({
            devDependencies: z
                .record(z.string(), z.object({ specifier: z.string() } satisfies SchemaShape<{ specifier: string }>))
                .optional(),
        } satisfies SchemaShape<{ devDependencies?: Record<string, { specifier: string }> | undefined }>),
    ),
} satisfies SchemaShape<{
    importers: Record<string, { devDependencies?: Record<string, { specifier: string }> | undefined }>;
}>);

const yarnLockfileSchema = z.record(
    z.string(),
    z.looseObject({ version: z.string().optional(), resolved: z.string().optional() } satisfies SchemaShape<{
        version?: string | undefined;
        resolved?: string | undefined;
    }>),
) satisfies z.ZodType<Record<string, { version?: string | undefined; resolved?: string | undefined }>>;

const bunPackagesSchema = z.looseObject({ packages: z.record(z.string(), z.array(z.unknown())) } satisfies SchemaShape<{
    packages: Record<string, unknown[]>;
}>);

const bunPackageSchema = z.tuple([z.string(), z.string(), z.record(z.string(), z.unknown()), z.string()]);

// Whether a parsed Yarn lockfile resolves each requested descriptor to its pinned version.
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

// The registry a package resolves through: its scope's, or the default one.
function findPackageRegistry(name: string, env: Record<string, string>): string | undefined {
    const scope = name.startsWith('@') ? name.split('/', 1)[0] : undefined;
    const scopeRegistry = scope === undefined ? undefined : env[`${NPM_SETTING_PREFIX}${scope}:registry`];
    return scopeRegistry ?? env[`${NPM_SETTING_PREFIX}registry`];
}

// Whether a Bun lockfile entry resolved the standard tarball of a valid npm version through the configured registry.
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

// The registry-relative form of a resolved URL under the registry, or undefined when it lies elsewhere.
function stripRegistryPrefix(address: string, base: URL): string | undefined {
    if (!HTTP_URL.test(address)) return undefined;
    const url = new URL(address);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return undefined;
    return `${url.pathname.slice(base.pathname.length)}${url.search}${url.hash}`;
}

/**
 * Rewrite resolved URLs under the registry as relative paths, retaining Yarn's formatting.
 * Throw if any other entry changes.
 *
 * @param content the lockfile text Yarn wrote.
 * @param registry the registry URL its resolved references start with.
 *
 * @returns the lockfile text with registry-relative references.
 */
function stripYarnRegistryUrls(content: string, registry: string): string {
    const entries = yarnLockfileSchema.parse(parseSyml(content));
    const expected = structuredClone(entries);
    const base = new URL(registry.endsWith('/') ? registry : `${registry}/`);
    let edited = content;
    for (const entry of Object.values(expected)) {
        const relative = entry.resolved === undefined ? undefined : stripRegistryPrefix(entry.resolved, base);
        if (relative === undefined) continue;
        edited = edited.replaceAll(JSON.stringify(entry.resolved), JSON.stringify(relative));
        entry.resolved = relative;
    }
    if (!isDeepStrictEqual(yarnLockfileSchema.parse(parseSyml(edited)), expected))
        throw new GspotError(
            'installation',
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
 * @returns the lockfile text without the registry's tarball URLs.
 */
function stripBunRegistryUrls(content: string, env: Record<string, string>): string {
    const parsed = bunPackagesSchema.parse(parseJsonc(content));
    let edited = content;
    for (const [key, entry] of Object.entries(parsed.packages)) {
        const npm = bunPackageSchema.safeParse(entry);
        if (!npm.success || !isStandardTarball(npm.data, env)) continue;
        edited = applyEdits(edited, modify(edited, ['packages', key, 1], '', {}));
    }
    return edited;
}

/**
 * Root lockfile dependencies.
 *
 * @param name the tool or setting name.
 * @param content the lockfile text.
 *
 * @returns the dependencies recorded for the root project.
 */
function parseRootDependencies(name: Exclude<PackageManager['name'], 'yarn'>, content: string): DependencyMap {
    if (name === 'npm' || name === 'bun') {
        const root =
            name === 'npm'
                ? npmLockfileSchema.parse(JSON.parse(content)).packages['']
                : bunLockfileSchema.parse(parseJsonc(content)).workspaces[''];
        if (root?.devDependencies === undefined) return {};
        return root.devDependencies;
    }
    const pinned = pnpmLockfileSchema.parse(parseYaml(content)).importers[PNPM_ROOT_IMPORTER]?.devDependencies;
    if (pinned === undefined) return {};
    return Object.fromEntries(Object.entries(pinned).map(([key, value]) => [key, value.specifier]));
}

/**
 * Whether a lockfile pins every generated dependency.
 * npm, Bun, and pnpm must have no additional root dependencies; Yarn may retain extra entries.
 *
 * @param name the package manager that wrote the lockfile.
 * @param content the lockfile text.
 * @param dependencies the dependencies the tool project declares.
 *
 * @returns true when the lockfile matches.
 */
export function isLockfileCurrent(name: PackageManager['name'], content: string, dependencies: DependencyMap): boolean {
    try {
        if (name === 'yarn') {
            const parsed = yarnLockfileSchema.safeParse(parseSyml(content));
            return parsed.success && isYarnLockfileCurrent(parsed.data, dependencies);
        }
        return isDeepStrictEqual(parseRootDependencies(name, content), dependencies);
    } catch {
        return false;
    }
}

/**
 * Remove registry locations from portable lockfile bytes.
 *
 * @param work the tool project directory.
 * @param packageManager the selected package manager.
 * @param root0 the values for this generated file.
 * @param root0.env the environment for the tool process.
 * @param root0.lockfile the resolved lockfile bytes.
 */
export function stripRegistryUrls(
    work: string,
    packageManager: PackageManager,
    { env, lockfile }: PackageCommandResult,
): void {
    const lockfilePath = join(work, selectLockfileName(packageManager.name));
    if (packageManager.name === 'bun') writeFileSync(lockfilePath, stripBunRegistryUrls(lockfile, env));
    if (packageManager.name !== 'yarn' || isYarnBerry(packageManager)) return;
    const registry = env[`${NPM_SETTING_PREFIX}registry`];
    if (registry === undefined)
        throw new GspotError('installation', 'A Yarn 1 lockfile needs npm_config_registry to relocate its URLs.');
    writeFileSync(lockfilePath, stripYarnRegistryUrls(lockfile, registry));
}
