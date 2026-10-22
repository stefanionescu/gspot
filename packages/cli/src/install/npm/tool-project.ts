// Validate npm tool projects and choose their lockfiles.
import { parseJsonFile } from '#cli/parsers/json.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { NpmToolProject } from '#cli/types/install/tool-projects.ts';
import { DOT_GSPOT, NPM_TOOL_PROJECT_FILE } from '#cli/config/gspot-paths.ts';
import type { PackageManager } from '#cli/types/repository/package-manager.ts';
import { toolPackageJsonSchema } from '#cli/schemas/install/npm/tool-project.ts';
import type { Lockfile, ToolProjectLockfileName } from '#cli/types/parsers/lockfiles.ts';

/**
 * Validate an npm tool project, and choose the lockfile of the package manager.
 *
 * @param text the generated or recorded package.json contents.
 * @param packageManagerName the name to match.
 * @returns the dependencies and the lockfile path.
 */
export function parseToolPackageJson(text: string, packageManagerName: PackageManager['name']): NpmToolProject {
    const parsed = toolPackageJsonSchema.parse(parseJsonFile(NPM_TOOL_PROJECT_FILE, text));
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
        LOCKFILES.filter((entry) => 'toolProject' in entry).find(
            (entry) => entry.packageManager === packageManager,
        ) as Extract<Lockfile, { toolProject: true }>
    ).file;
}
