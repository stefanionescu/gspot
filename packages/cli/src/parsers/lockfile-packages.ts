import { z } from 'zod';
import { posix } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseSyml } from '@yarnpkg/parsers';
import { parseJsonc } from '#cli/parsers/json.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { LEADING_SLASH } from '#cli/config/system/paths.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { normalizePythonPackage } from '#cli/parsers/dependency-files.ts';
import type { LOCKED_PACKAGE_LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { PNPM_PEER_START, NPM_PACKAGE_FOLDER } from '#cli/config/parsers/lockfiles.ts';

const npmLockSchema = z.looseObject({
    packages: z.record(z.string(), z.looseObject({ version: z.string().optional() })).default({}),
} satisfies SchemaShape<{ packages: Record<string, { version?: string | undefined }> }>);

const bunLockSchema = z.looseObject({
    packages: z.record(z.string(), z.array(z.unknown())).default({}),
} satisfies SchemaShape<{ packages: Record<string, unknown[]> }>);

const pnpmLockSchema = z.looseObject({
    packages: z.record(z.string(), z.unknown()).default({}),
} satisfies SchemaShape<{ packages: Record<string, unknown> }>);

const yarnLockSchema = z.record(z.string(), z.unknown());

const uvLockSchema = z.looseObject({
    package: z.array(z.looseObject({ name: z.string(), version: z.string().optional() })).default([]),
} satisfies SchemaShape<{ package: { name: string; version?: string | undefined }[] }>);

/**
 * Split a package identity into its name and version. The separator follows the name; a scoped name starts with @.
 * @param identity the package as `name@version`.
 * @returns the name and the version, or undefined without a version.
 */
function splitIdentity(identity: string): [string, string] | undefined {
    const separator = identity.indexOf('@', 1);
    return separator === -1 ? undefined : [identity.slice(0, separator), identity.slice(separator + 1)];
}

function readNpmPackages(text: string): string[] {
    return Object.entries(npmLockSchema.parse(parseJsonc(text)).packages).flatMap(([path, entry]) => {
        const index = path.lastIndexOf(NPM_PACKAGE_FOLDER);
        if (index === -1 || entry.version === undefined) return [];
        return [`${path.slice(index + NPM_PACKAGE_FOLDER.length)}@${entry.version}`];
    });
}

function readBunPackages(text: string): string[] {
    return Object.values(bunLockSchema.parse(parseJsonc(text)).packages).flatMap(([identity]) =>
        typeof identity === 'string' && splitIdentity(identity) !== undefined ? [identity] : [],
    );
}

function readPnpmPackages(text: string): string[] {
    return Object.keys(pnpmLockSchema.parse(parseYaml(text)).packages).map((key) => {
        const name = key.replace(LEADING_SLASH, '');
        const peers = name.indexOf(PNPM_PEER_START);
        return peers === -1 ? name : name.slice(0, peers);
    });
}

function readYarnPackages(text: string): string[] {
    return Object.entries(yarnLockSchema.parse(parseSyml(text))).flatMap(([descriptors, entry]) => {
        const version = z.looseObject({ version: z.string() }).safeParse(entry);
        const name = splitIdentity(descriptors.split(',', 1)[0]?.trim() ?? '')?.[0];
        return version.success && name !== undefined ? [`${name}@${version.data.version}`] : [];
    });
}

function readUvPackages(text: string): string[] {
    return uvLockSchema
        .parse(parseToml(text))
        .package.flatMap(({ name, version }) =>
            version === undefined ? [] : [`${normalizePythonPackage(name)}@${version}`],
        );
}

const READERS: Readonly<Record<(typeof LOCKED_PACKAGE_LOCKFILES)[number], (text: string) => string[]>> = {
    'package-lock.json': readNpmPackages,
    'npm-shrinkwrap.json': readNpmPackages,
    'bun.lock': readBunPackages,
    'pnpm-lock.yaml': readPnpmPackages,
    'yarn.lock': readYarnPackages,
    'uv.lock': readUvPackages,
};

/**
 * Find the nearest lockfile of a project, from its folder up to the repository root, and list what it holds.
 * @param reads the run cache, rooted at the repository.
 * @param folder the project folder, relative to the repository root.
 * @param lockfiles the lockfile names of the project's package manager family, in the order to try.
 * @returns each locked package as `name@version`, or undefined when no lockfile sits on the way to the root.
 */
export function readLockedPackages(
    reads: ReadCache,
    folder: string,
    lockfiles: readonly (typeof LOCKED_PACKAGE_LOCKFILES)[number][],
): Set<string> | undefined {
    const segments = folder === '' || folder === '.' ? [] : folder.split('/');
    for (let depth = segments.length; depth >= 0; depth -= 1) {
        const base = segments.slice(0, depth).join('/');
        for (const lockfile of lockfiles) {
            const text = readCachedText(reads, posix.join(base, lockfile));
            if (text !== undefined) return new Set(READERS[lockfile](text));
        }
    }
    return undefined;
}

export { splitIdentity };
