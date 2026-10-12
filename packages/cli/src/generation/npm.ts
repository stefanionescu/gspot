import semver from 'semver';
import { join } from 'node:path';
import { GspotError } from '#cli/errors.ts';
import { isYarnBerry } from '#cli/parsers/npm-client.ts';
import { toolProjectPins } from '#cli/configurations/tool-pins.ts';
import { NEXTJS_CONFIGURATION } from '#cli/config/generation/eslint.ts';
import { installedDependency } from '#cli/repository/dependency-files.ts';
import type { GeneratedFile, NpmProjectInputs } from '#cli/types/generation/files.ts';
import { YARN_SETTINGS, NPM_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';
import { NPM_TOOL_PROJECT, NEXT_ESLINT_PLUGIN } from '#cli/config/parsers/dependency-files.ts';
import { JSON_INDENT, NEXT_PACKAGE, YARN_TOOL_PROJECT_SETTINGS } from '#cli/config/generation/tool-projects.ts';

/**
 * Generate the npm tools as a tool project without adding dependencies to the repository.
 *
 * @param inputs the selected source projects, tool manifests, and package manager.
 * @param inputs.root the repository root.
 * @param inputs.scopes the selected source scopes.
 * @param inputs.manifests the selected tool declarations.
 * @param inputs.installer the repository package manager, or undefined without one.
 *
 * @returns the tool project's files, or none without a package manager.
 */
export function npmProject({ root, scopes, manifests, installer }: NpmProjectInputs): GeneratedFile[] {
    if (installer === undefined) return [];
    const pins = toolProjectPins(manifests).npm;
    const nextVersions = scopes
        .filter(({ selected }) => selected.some(({ configuration }) => configuration.name === NEXTJS_CONFIGURATION))
        .flatMap(({ scope }) => {
            const version = installedDependency(root, join(scope.path, 'package.json'), NEXT_PACKAGE)?.version;
            return version === undefined ? [] : [{ scope: scope.path, major: semver.major(version) }];
        });
    const majors = new Set(nextVersions.map(({ major }) => major));
    const requirements = nextVersions
        .map(({ scope, major }) => `${scope || 'the root'} requires ^${String(major)}`)
        .join('; ');
    if (majors.size > 1)
        throw new GspotError('installation', [`Tool pin ${NEXT_ESLINT_PLUGIN} conflicts: ${requirements}.`]);
    const major = majors.values().next().value;
    if (major !== undefined) pins[NEXT_ESLINT_PLUGIN] = `^${String(major)}`;
    const files: GeneratedFile[] = [
        {
            path: NPM_TOOL_PROJECT_FILE,
            content: `${JSON.stringify(
                {
                    ...NPM_TOOL_PROJECT,
                    devDependencies: pins,
                },
                null,
                JSON_INDENT,
            )}\n`,
            kind: 'tool_file',
        },
    ];
    if (isYarnBerry(installer))
        files.push({
            path: YARN_SETTINGS,
            content: YARN_TOOL_PROJECT_SETTINGS,
            kind: 'tool_file',
        });
    return files;
}
