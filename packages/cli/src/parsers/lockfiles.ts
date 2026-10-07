// Dependency lockfile readers provide root pins and format metadata.
import { parse as parseYaml } from 'yaml';
import { parseSyml } from '@yarnpkg/parsers';
import { parse as parseToml } from 'smol-toml';
import { parseJsonc } from '#cli/parsers/jsonc.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { Lockfile, LockfileName } from '#cli/types/parsers/lockfiles.ts';
import type { DependencyMap, PackageInstaller } from '#cli/types/parsers/packages.ts';

import {
    bunLockfileSchema,
    npmLockfileSchema,
    pnpmLockfileSchema,
    pnpmSpecifiersSchema,
} from '#cli/parsers/schema/lockfiles.ts';

/**
 * Parse a supported textual lockfile using its native syntax.
 * @param filename the supported lockfile name
 * @param text the complete lockfile source
 * @returns the parsed value for format-specific validation
 */
export function parseLockfile(filename: LockfileName, text: string): unknown {
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
export function rootLockfileDependencies(
    name: Exclude<PackageInstaller['name'], 'yarn'>,
    content: string,
): DependencyMap {
    if (name === 'npm' || name === 'bun') {
        const root =
            name === 'npm'
                ? npmLockfileSchema.parse(parseLockfile('package-lock.json', content)).packages['']
                : bunLockfileSchema.parse(parseLockfile('bun.lock', content)).workspaces[''];
        if (root?.devDependencies === undefined) return {};
        return root.devDependencies;
    }
    const pinned = pnpmLockfileSchema.parse(parseLockfile('pnpm-lock.yaml', content)).importers['.']?.devDependencies;
    const entries = pnpmSpecifiersSchema.parse(pinned);
    return Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, value.specifier]));
}

/**
 * Read the declared consumers of one repository lockfile.
 * @param filename the file basename
 * @returns its metadata, or undefined for an unsupported filename
 */
export function lockfileEntry(filename: string): Lockfile | undefined {
    return LOCKFILES.find((entry) => entry.file === filename);
}
