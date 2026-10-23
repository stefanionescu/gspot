import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import type { NpmToolProject } from '#cli/types/install/tool-projects.ts';
import { toolPackageJsonSchema } from '#cli/schemas/install/npm/package-json.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';
import type { Lockfile, ToolProjectLockfileName } from '#cli/types/parsers/projects/lockfiles.ts';

/**
 * Validate an npm tool project, and choose the lockfile of the package manager.
 *
 * @param text the generated or recorded package.json contents.
 * @param packageManagerName the name to match.
 * @returns the dependencies and the lockfile path.
 */
export function parseToolPackageJson(text: string, packageManagerName: PackageManager['name']): NpmToolProject {
    const parsed = toolPackageJsonSchema.parse(parseJsonFile(GSPOT_PATHS.npmProject, text));
    const lockfile = selectLockfileName(packageManagerName);
    return { dependencies: parsed.devDependencies, lockfile, lockfilePath: `${DOT_GSPOT}/${lockfile}` };
}

/**
 * Select the lockfile name for the package manager of an npm tool project.
 *
 * @param packageManager the validated name.
 * @returns the lockfile basename that LOCKFILES declares.
 */
export function selectLockfileName(packageManager: PackageManager['name']): ToolProjectLockfileName {
    return (
        LOCKFILES.filter((lockfile) => 'toolProject' in lockfile).find(
            (lockfile) => lockfile.packageManager === packageManager,
        ) as Extract<Lockfile, { toolProject: true }>
    ).file;
}
