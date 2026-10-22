import semver from 'semver';
import { join } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import { type Configuration } from '#cli/types/configurations.ts';
import { NEXTJS_CONFIGURATION } from '#cli/config/configurations.ts';
import { findInstalledDependency } from '#cli/repository/npm/installed-packages.ts';
import { JSON_INDENT, TOOL_FILE_TOML_FORMAT } from '#cli/config/generation/generate.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/declared-tools.ts';
import { type GeneratedFile, type PlannedNpmProject } from '#cli/types/generation/files.ts';

import {
    YARN_SETTINGS,
    NPM_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/gspot-paths.ts';
import {
    NEXT_PACKAGE,
    NPM_TOOL_PROJECT,
    UV_PROJECT_TABLE,
    NEXT_ESLINT_PLUGIN,
    PYTHON_TOOL_PROJECT,
    YARN_TOOL_PROJECT_SETTINGS,
} from '#cli/config/generation/projects.ts';

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
        path: MISE_TOOL_PROJECT_FILE,
        content: stringify({ tools }, { ...TOOL_FILE_TOML_FORMAT, inlineTableStart: 1 }),
    };
}

/**
 * Build the npm tools as a tool project, and add no dependencies to the repository.
 *
 * @param project what the tool project holds.
 * @param project.root the repository folder.
 * @param project.scopes the source projects.
 * @param project.configurations the configurations with npm tools.
 * @param project.isYarnBerry true for Yarn 2 or later as the repository package manager.
 *
 * @returns the tool project files.
 */
export function buildNpmProject({ root, scopes, configurations, isYarnBerry }: PlannedNpmProject): GeneratedFile[] {
    const pins = listToolProjectPins(configurations).npm;
    const nextVersions = scopes
        .filter(({ configurations: selected }) =>
            selected.some((configuration) => configuration.name === NEXTJS_CONFIGURATION),
        )
        .flatMap(({ folder }) => {
            const version = findInstalledDependency(root, join(folder.path, 'package.json'), NEXT_PACKAGE)?.version;
            return version === undefined ? [] : [{ scope: folder.path, major: semver.major(version) }];
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
            path: PYTHON_TOOL_PROJECT_FILE,
            content:
                stringify({ project: { ...PYTHON_TOOL_PROJECT, dependencies } }, TOOL_FILE_TOML_FORMAT) +
                // toml-patch writes an empty [tool] table before [tool.uv], so this code writes the table header
                // itself.
                `\n${UV_PROJECT_TABLE}\n` +
                stringify({ package: false, 'exclude-newer': `${String(days)} days` }, TOOL_FILE_TOML_FORMAT),
        },
    ];
}
