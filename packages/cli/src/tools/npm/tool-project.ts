// Validate npm tool projects and choose their lockfiles.
import { z } from 'zod';
import semver from 'semver';
import { parseJsonFile } from '#cli/parsers/json.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';
import type { NpmProjectFile, NpmToolProject } from '#cli/types/tools/project.ts';
import { DOT_GSPOT, NPM_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';
import type { Lockfile, ToolProjectLockfileName } from '#cli/types/parsers/lockfiles.ts';

import {
    NPM_TOOL_PROJECT,
    NEXT_ESLINT_PLUGIN,
    NEXT_ESLINT_PLUGIN_MAJOR,
} from '#cli/config/parsers/dependency-files.ts';

const toolDependencyVersion = z.string().refine((value) => semver.valid(value) !== null) satisfies z.ZodType<string>;

const toolProjectSchema = z.strictObject({
    private: z.literal(NPM_TOOL_PROJECT.private),
    devDependencies: z
        .object({
            [NEXT_ESLINT_PLUGIN]: toolDependencyVersion.or(z.string().regex(NEXT_ESLINT_PLUGIN_MAJOR)).optional(),
        } satisfies SchemaShape<Pick<NpmProjectFile['devDependencies'], typeof NEXT_ESLINT_PLUGIN>>)
        .catchall(toolDependencyVersion),
} satisfies SchemaShape<NpmProjectFile>);

/**
 * Validate an npm tool project and identify its package manager and lockfile.
 * @param text the generated or recorded package.json contents.
 * @param packageManagerName the selected package manager name.
 * @returns the dependencies and selected lockfile path.
 */
export function parseToolProject(text: string, packageManagerName: PackageManager['name']): NpmToolProject {
    const parsed = toolProjectSchema.parse(parseJsonFile(NPM_TOOL_PROJECT_FILE, text));
    const lockfile = selectLockfileName(packageManagerName);
    return { dependencies: parsed.devDependencies, lockfile, lockfilePath: `${DOT_GSPOT}/${lockfile}` };
}

/**
 * Select the lockfile of a npm tool project's manager.
 * @param packageManager the validated package manager.
 * @returns the lockfile basename declared by its registry entry.
 */
export function selectLockfileName(packageManager: PackageManager['name']): ToolProjectLockfileName {
    return (
        LOCKFILES.filter((entry) => 'toolProject' in entry).find((entry) => entry.client === packageManager) as Extract<
            Lockfile,
            { toolProject: true }
        >
    ).file;
}
