import semver from 'semver';
import { posix } from 'node:path';
import { JSON_INDENT } from '#cli/config/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import { type Configuration } from '#cli/types/configurations.ts';
import { NEXTJS_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/config-files/build.ts';
import { type GeneratedFile, type PlannedNpmProject } from '#cli/types/generation/files.ts';

import {
    NEXT_PACKAGE,
    NPM_TOOL_PROJECT,
    UV_PROJECT_TABLE,
    NEXT_ESLINT_PLUGIN,
    PYTHON_TOOL_PROJECT,
    YARN_TOOL_PROJECT_SETTINGS,
} from '#cli/config/generation/tool-projects.ts';

/**
 * Build the mise tool project without the runtime pins of the repository.
 *
 * @param configurations the configurations in use.
 *
 * @returns the mise tool project.
 */
export function buildMiseProject(configurations: Configuration[]): GeneratedFile {
    const tools = Object.fromEntries(
        listMisePins(configurations)
            .toSorted((left, right) => left.name.localeCompare(right.name))
            .map((pin) => [
                pin.name,
                pin.options === undefined ? pin.version : { version: pin.version, ...pin.options },
            ]),
    );
    return {
        path: GSPOT_PATHS.miseProject,
        content: stringify({ tools }, { ...CONFIG_FILE_TOML_FORMAT, inlineTableStart: 1 }),
    };
}

/**
 * Build the npm tools as a tool project, and add no dependencies to the repository.
 *
 * @param project what the tool project holds.
 * @param project.dependencyFiles the declared project dependencies.
 * @param project.scopes the source projects.
 * @param project.configurations the configurations with npm tools.
 * @param project.isYarnBerry true for Yarn 2 or later as the repository package manager.
 *
 * @returns the tool project files.
 */
export function buildNpmProject({
    dependencyFiles,
    scopes,
    configurations,
    isYarnBerry,
}: PlannedNpmProject): GeneratedFile[] {
    const pins = listToolProjectPins(configurations).npm;
    const projects = new Map(
        dependencyFiles.filter((file) => file.kind === PACKAGE_JSON).map((file) => [file.path, file]),
    );
    const nextVersions = scopes
        .filter(({ configurations: selected }) =>
            selected.some((configuration) => configuration.name === NEXTJS_CONFIGURATION),
        )
        .flatMap(({ folder }) => {
            const project = listEnclosingFolders(folder.path)
                .map((path) => projects.get(posix.join(path, PACKAGE_JSON)))
                .find((file) => file !== undefined);
            const range = project?.dependencies[NEXT_PACKAGE];
            const version = range !== undefined && semver.validRange(range) !== null ? semver.minVersion(range) : null;
            return version === null ? [] : [{ scope: folder.path, major: version.major }];
        });
    const majors = new Set(nextVersions.map(({ major }) => major));
    const requirements = nextVersions
        .map(({ scope, major }) => `${scope === '' ? 'the root' : scope} requires ^${String(major)}`)
        .join('; ');
    if (majors.size > 1) throw new GspotError('install', `Tool pin ${NEXT_ESLINT_PLUGIN} conflicts: ${requirements}.`);
    const major = majors.values().next().value;
    if (major !== undefined) pins[NEXT_ESLINT_PLUGIN] = `^${String(major)}`;
    const files: GeneratedFile[] = [
        {
            path: GSPOT_PATHS.npmProject,
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
            path: GSPOT_PATHS.yarnSettings,
            content: YARN_TOOL_PROJECT_SETTINGS,
        });
    return files;
}

/**
 * Build the Python tool project that holds the Python lint tools.
 *
 * @param configurations the configurations in use.
 * @param days the minimum release age, so uv installs no release newer than that.
 * @returns the Python tool project files, or none without Python tools.
 */
export function buildPythonProject(configurations: Configuration[], days: number): GeneratedFile[] {
    const { python: dependencies } = listToolProjectPins(configurations);
    if (dependencies.length === 0) return [];
    return [
        {
            path: GSPOT_PATHS.pythonProject,
            content:
                stringify({ project: { ...PYTHON_TOOL_PROJECT, dependencies } }, CONFIG_FILE_TOML_FORMAT) +
                `\n${UV_PROJECT_TABLE}\n` +
                stringify({ package: false, 'exclude-newer': `${String(days)} days` }, CONFIG_FILE_TOML_FORMAT),
        },
    ];
}
