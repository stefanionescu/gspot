import semver from 'semver';
import { join } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import { type Manifest } from '#cli/types/configurations.ts';
import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { TOML_FORMAT } from '#cli/config/generation/settings.ts';
import { NEXTJS_CONFIGURATION } from '#cli/config/configurations.ts';
import { findInstalledDependency } from '#cli/repository/packages.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';
import { type GeneratedFile, type NpmProjectInputs } from '#cli/types/generation/files.ts';
import { NPM_TOOL_PROJECT, NEXT_ESLINT_PLUGIN, PYTHON_TOOL_PROJECT } from '#cli/config/parsers/dependencies.ts';
import { NEXT_PACKAGE, UV_PROJECT_TABLE, YARN_TOOL_PROJECT_SETTINGS } from '#cli/config/generation/tool-projects.ts';

import {
    YARN_SETTINGS,
    NPM_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';

/**
 * Generate the mise tool project without the runtime pins of the repository.
 *
 * @param manifests the configurations in use.
 *
 * @returns the mise tool project.
 */
export function buildMiseProject(manifests: Manifest[]): GeneratedFile {
    const tools = Object.fromEntries(
        listMisePins(manifests)
            .toSorted((left, right) => left.name.localeCompare(right.name))
            .map((pin) => [
                pin.name,
                pin.options === undefined ? pin.version : { version: pin.version, ...pin.options },
            ]),
    );
    return {
        path: MISE_TOOL_PROJECT_FILE,
        content: stringify({ tools }, { ...TOML_FORMAT, inlineTableStart: 1 }),
    };
}

/**
 * Generate the npm tools as a tool project, and add no dependencies to the repository.
 *
 * @param inputs what the tool project holds.
 * @param inputs.root the repository folder.
 * @param inputs.scopes the source projects.
 * @param inputs.manifests the configurations with npm tools.
 * @param inputs.isYarnBerry true for Yarn 2 or later as the repository package manager.
 *
 * @returns the tool project files.
 */
export function buildNpmProject({ root, scopes, manifests, isYarnBerry }: NpmProjectInputs): GeneratedFile[] {
    const pins = listToolProjectPins(manifests).npm;
    const nextVersions = scopes
        .filter(({ selected }) => selected.some(({ configuration }) => configuration.name === NEXTJS_CONFIGURATION))
        .flatMap(({ scope }) => {
            const version = findInstalledDependency(root, join(scope.path, 'package.json'), NEXT_PACKAGE)?.version;
            return version === undefined ? [] : [{ scope: scope.path, major: semver.major(version) }];
        });
    const majors = new Set(nextVersions.map(({ major }) => major));
    const requirements = nextVersions
        .map(({ scope, major }) => `${scope === '' ? 'the root' : scope} requires ^${String(major)}`)
        .join('; ');
    if (majors.size > 1)
        throw new GspotError('installation', `Tool pin ${NEXT_ESLINT_PLUGIN} conflicts: ${requirements}.`);
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
        },
    ];
    if (isYarnBerry)
        files.push({
            path: YARN_SETTINGS,
            content: YARN_TOOL_PROJECT_SETTINGS,
        });
    return files;
}

/**
 * Generate the Python tool project that holds the Python lint tools.
 *
 * @param manifests the configurations in use.
 * @param days the release hold, so uv installs no release newer than that.
 *
 * @returns the Python tool project files, or none without Python tools.
 */
export function buildPythonProject(manifests: Manifest[], days: number): GeneratedFile[] {
    const { python: dependencies } = listToolProjectPins(manifests);
    if (dependencies.length === 0) return [];
    return [
        {
            path: PYTHON_TOOL_PROJECT_FILE,
            content:
                stringify({ project: { ...PYTHON_TOOL_PROJECT, dependencies } }, TOML_FORMAT) +
                `\n${UV_PROJECT_TABLE}\n` +
                stringify({ package: false, 'exclude-newer': `${String(days)} days` }, TOML_FORMAT),
        },
    ];
}
