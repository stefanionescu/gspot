// Select the declared package manager and resolve its version requirement when npm tools require it.
import semver from 'semver';
import { join, dirname } from 'node:path';
import { detectPackageManager } from 'nypm';
import { GspotError } from '#cli/platform/errors.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { VERSION_TIMEOUT_MS } from '#cli/config/tools/install.ts';
import { readPackageManifest } from '#cli/repository/package-manifests.ts';
import { DOT_GSPOT, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';
import { parsePackageInstaller, declaredPackageInstaller } from '#cli/parsers/packages.ts';
import type { PackageInstaller, PackageInstallerIdentity } from '#cli/types/parsers/packages.ts';

import {
    packageManifestSchema,
    packageInstallerSchema,
    packageInstallerIdentitySchema,
    packageInstallerDeclarationSchema,
} from '#cli/parsers/schema/packages.ts';

// The first package manager a candidate manifest declares, reading each manifest that exists on the way.
async function detectedInstaller(root: string, candidates: string[]) {
    for (const path of candidates) {
        const manifest = readPackageManifest(root, path);
        const declared = manifest === undefined ? undefined : declaredPackageInstaller(manifest);
        if (declared !== undefined) return declared;
        const detected = await detectPackageManager(join(root, dirname(path)), {
            ignoreArgv: true,
            ignorePackageJSON: true,
            includeParentDirs: false,
        });
        if (detected !== undefined)
            return packageInstallerDeclarationSchema.parse({ name: detected.name, version: detected.version });
    }
    return undefined;
}

// The manager the tool project recorded, or undefined when the file does not parse, as when a merge left its markers.
function recordedInstaller(bytes: Buffer): PackageInstaller | undefined {
    let held: unknown;
    try {
        held = JSON.parse(bytes.toString('utf8'));
    } catch {
        return undefined;
    }
    const parsed = packageManifestSchema.safeParse(held);
    if (!parsed.success || parsed.data.packageManager === undefined) return undefined;
    return parsePackageInstaller(parsed.data.packageManager);
}

/**
 * Read the repository manager and retain the version recorded for its isolated tool project.
 * @param root the repository root
 * @param trackedPaths the source paths inventoried in the repository
 * @returns the manager name and its declared or recorded version, when present
 */
export async function selectPackageInstaller(root: string, trackedPaths: string[]): Promise<PackageInstallerIdentity> {
    using files = openRoot(root);
    // The root declaration wins; without it, the first nested manifest provides a deterministic shared tool manager.
    const candidates = [
        'package.json',
        ...trackedPaths
            .filter((path) => path.endsWith('/package.json') && !path.startsWith(`${DOT_GSPOT}/`))
            .toSorted((left, right) => left.localeCompare(right))
            .slice(0, 1),
    ];
    const { name, version } = (await detectedInstaller(root, candidates)) ?? { name: 'npm', version: undefined };
    if (version !== undefined) {
        if (semver.valid(version) === null)
            throw new GspotError(
                'installation',
                `The tool project needs an exact ${name} version, such as ${name}@1.2.3, and package.json declares ${version}. Write an exact packageManager version.`,
            );
        return packageInstallerSchema.parse({ name, version });
    }
    const current = files.read(TOOL_PACKAGE_PROJECT);
    const recorded = current === undefined ? undefined : recordedInstaller(current.bytes);
    if (recorded?.name === name) return recorded;
    return packageInstallerIdentitySchema.parse({ name });
}

/**
 * Resolve an undeclared package manager version only when generating or installing a tool project.
 * @param root the repository root
 * @param installer the declared or detected package manager identity
 * @returns the name and version requirement used by the tool project
 */
export function inspectPackageInstaller(root: string, installer: PackageInstallerIdentity): PackageInstaller {
    const { name, version } = installer;
    if (version !== undefined) return { name, version };
    const result = runBlocking([name, '--version'], { cwd: root, timeoutMs: VERSION_TIMEOUT_MS });
    if (result.code !== 0) throw new GspotError('tool', `Cannot determine the ${name} version for the tool project.`);
    return packageInstallerSchema.parse({ name, version: result.stdout.trim() });
}
