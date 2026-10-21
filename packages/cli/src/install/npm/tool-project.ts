// Validate npm tool projects and choose their lockfiles.
import { parseJsonFile } from '#cli/parsers/json.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { NpmToolProject } from '#cli/types/tools/project.ts';
import type { PackageManager } from '#cli/types/parsers/dependencies.ts';
import { toolProjectSchema } from '#cli/schemas/install/npm/tool-project.ts';
import { DOT_GSPOT, NPM_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';
import type { Lockfile, ToolProjectLockfileName } from '#cli/types/parsers/lockfiles.ts';

/**
 * Validate an npm tool project and identify its package manager and lockfile.
 *
 * @param text the generated or recorded package.json contents.
 * @param packageManagerName the name to match.
 * @returns the dependencies and the lockfile path.
 */
export function parseToolProject(text: string, packageManagerName: PackageManager['name']): NpmToolProject {
    const parsed = toolProjectSchema.parse(parseJsonFile(NPM_TOOL_PROJECT_FILE, text));
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
