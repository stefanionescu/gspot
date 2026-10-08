import semver from 'semver';
import { join } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import { npmPins } from '#cli/configurations/pins.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import type { NpmProjectInputs } from '#cli/types/generation/npm.ts';
import { isYarnBerry, getPackageInstallerMajor } from '#cli/parsers/packages.ts';
import { installedDependencyVersion } from '#cli/repository/package-manifests.ts';
import { NPM_TOOL_PROJECT, NEXT_ESLINT_PLUGIN } from '#cli/config/parsers/packages.ts';
import { YARN_SETTINGS, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';
import { JSON_INDENT, YARN_TOOL_PROJECT_SETTINGS } from '#cli/config/generation/templates.ts';

/**
 * Generate the npm tools as a tool project without adding dependencies to the repository.
 * @param inputs the selected source projects, tool manifests, package manager, and task runner.
 * @param inputs.root the repository root.
 * @param inputs.scopes the selected source scopes.
 * @param inputs.manifests the selected tool declarations.
 * @param inputs.installer the repository package manager, or undefined without one.
 * @param inputs.runner the selected task runner, or undefined.
 * @returns the tool project's files, or none without a package manager.
 */
export function npmProject({ root, scopes, manifests, installer, runner }: NpmProjectInputs): GeneratedFile[] {
    if (installer === undefined) return [];
    const pins = npmPins(manifests, runner);
    const nextVersions = scopes
        .filter(({ selected }) => selected.some(({ configuration }) => configuration.name === 'nextjs'))
        .flatMap(({ scope }) => {
            const version = installedDependencyVersion(root, join(scope.path, 'package.json'), 'next');
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
            path: TOOL_PACKAGE_PROJECT,
            content: `${JSON.stringify(
                {
                    ...NPM_TOOL_PROJECT,
                    packageManager: `${installer.name}@${String(getPackageInstallerMajor(installer))}.x`,
                    devDependencies: pins,
                },
                null,
                JSON_INDENT,
            )}\n`,
            kind: 'config',
        },
    ];
    if (isYarnBerry(installer))
        files.push({
            path: YARN_SETTINGS,
            content: YARN_TOOL_PROJECT_SETTINGS,
            kind: 'config',
        });
    return files;
}
