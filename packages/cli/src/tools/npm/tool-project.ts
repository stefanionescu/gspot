// Validates npm tool projects and chooses their lockfiles.
import { z } from 'zod';
import semver from 'semver';
import type { SchemaShape } from '#cli/types/objects.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { NpmClient } from '#cli/types/parsers/dependency-files.ts';
import type { NpmProjectFile, NpmToolProject } from '#cli/types/tools/project.ts';
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
 * @param npmClient the package manager selected by the repository.
 * @returns the selected manager, dependencies, and repository-relative lockfile path.
 */
export function parseToolProject(text: string, npmClient: NpmClient): NpmToolProject {
    const parsed = toolProjectSchema.parse(JSON.parse(text));
    const lockfile = selectLockfileName(npmClient.name);
    return { npmClient, dependencies: parsed.devDependencies, lockfile, lockfilePath: `${DOT_GSPOT}/${lockfile}` };
}

/**
 * Select the lockfile of a npm tool project's manager.
 * @param npmClient the validated package manager.
 * @returns the lockfile basename declared by its registry entry.
 */
export function selectLockfileName(npmClient: NpmClient['name']): ToolProjectLockfileName {
    return (
        LOCKFILES.filter((entry) => 'toolProject' in entry).find((entry) => entry.client === npmClient) as Extract<
            Lockfile,
            { toolProject: true }
        >
    ).file;
}
