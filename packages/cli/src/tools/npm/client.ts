import semver from 'semver';
import { join, dirname } from 'node:path';
import { detectPackageManager } from 'nypm';
import { GspotError } from '#cli/system/errors.ts';
import { VERSION_FLAG } from '#cli/config/tools/run.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { NPM_PROGRAM, NPM_CLIENT_DETECTION } from '#cli/config/tools/npm.ts';
import type { NpmClient, NpmClientIdentity } from '#cli/types/parsers/dependency-files.ts';

import {
    packageManagerSchema,
    npmClientIdentitySchema,
    readPackageManagerDeclaration,
    packageManagerDeclarationSchema,
} from '#cli/tools/npm/package-manager.ts';

// Read the package manager from repository declarations and lockfiles.
async function detectedNpmClient(root: string, candidates: string[]) {
    for (const path of candidates) {
        const manifest = readPackageJson(root, path);
        const declared = manifest === undefined ? undefined : readPackageManagerDeclaration(manifest);
        if (declared !== undefined) return declared;
        const detected = await detectPackageManager(join(root, dirname(path)), NPM_CLIENT_DETECTION);
        if (detected !== undefined)
            return packageManagerDeclarationSchema.parse({ name: detected.name, version: detected.version });
    }
    return { name: NPM_PROGRAM, version: undefined };
}

/**
 * Select the repository package manager from its declaration and lockfiles.
 *
 * @param root the repository root.
 * @param trackedPaths the source paths inventoried in the repository.
 *
 * @returns the manager name and its declared or detected version, when present.
 */
export async function selectNpmClient(root: string, trackedPaths: string[]): Promise<NpmClientIdentity> {
    // The root declaration wins; without it, the first nested manifest provides a deterministic shared tool manager.
    const candidates = [
        PACKAGE_JSON,
        ...trackedPaths
            .filter((path) => path.endsWith('/package.json') && !path.startsWith(`${DOT_GSPOT}/`))
            .toSorted((left, right) => left.localeCompare(right))
            .slice(0, 1),
    ];
    const { name, version } = await detectedNpmClient(root, candidates);
    if (version !== undefined) {
        if (semver.valid(version) === null)
            throw new GspotError(
                'installation',
                `The tool project needs an exact ${name} version, such as ${name}@1.2.3, and package.json declares ${version}. Write an exact packageManager version.`,
            );
        return packageManagerSchema.parse({ name, version });
    }
    return npmClientIdentitySchema.parse({ name });
}

/**
 * Resolve an undeclared package manager version only when generating or installing a tool project.
 *
 * @param root the repository root.
 * @param client the declared or detected package manager identity.
 * @param timeoutSeconds the tool timeout in seconds.
 *
 * @returns the name and version requirement used by the tool project.
 */
export function readNpmClientVersion(root: string, client: NpmClientIdentity, timeoutSeconds: number): NpmClient {
    const { name, version } = client;
    if (version !== undefined) return { name, version };
    const result = spawnProcessBlocking([name, VERSION_FLAG], {
        cwd: root,
        timeoutSeconds: timeoutSeconds,
    });
    if (result.code !== 0) throw new GspotError('tool', `Cannot determine the ${name} version for the tool project.`);
    return packageManagerSchema.parse({ name, version: result.stdout.trim() });
}
