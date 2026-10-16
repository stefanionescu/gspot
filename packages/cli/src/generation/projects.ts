import semver from 'semver';
import { join } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import type { ReadCache } from '#cli/types/system/files.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import { isYarnBerry } from '#cli/tools/npm/package-manager.ts';
import { findInstalledDependency } from '#cli/tools/npm/packages.ts';
import { NEXTJS_CONFIGURATION } from '#cli/config/generation/eslint.ts';
import { TOOL_EMIT_FORMAT } from '#cli/config/generation/tool-file-sources.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';
import { type GeneratedFile, type NpmProjectInputs } from '#cli/types/generation/files.ts';
import { NPM_TOOL_PROJECT, NEXT_ESLINT_PLUGIN, PYTHON_TOOL_PROJECT } from '#cli/config/parsers/dependency-files.ts';

import {
    JSON_INDENT,
    NEXT_PACKAGE,
    UV_PROJECT_TABLE,
    YARN_TOOL_PROJECT_SETTINGS,
} from '#cli/config/generation/tool-projects.ts';
import {
    YARN_SETTINGS,
    NPM_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';

/**
 * Emit the program tool project without repository runtime pins.
 *
 * @param manifests the selected configuration manifests.
 * @param reads the run cache.
 *
 * @returns the mise tool project.
 */
export function buildMiseProject(manifests: Manifest[], reads: ReadCache): GeneratedFile {
    const tools = Object.fromEntries(
        listMisePins(manifests, reads).map((pin) => [
            pin.name,
            pin.options === undefined ? pin.version : { version: pin.version, ...pin.options },
        ]),
    );
    return {
        path: MISE_TOOL_PROJECT_FILE,
        content: stringify({ tools }, { ...TOOL_EMIT_FORMAT, inlineTableStart: 1 }),
        kind: 'tool_file',
    };
}

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
export function buildNpmProject({ root, scopes, manifests, installer }: NpmProjectInputs): GeneratedFile[] {
    if (installer === undefined) return [];
    const pins = listToolProjectPins(manifests).npm;
    const nextVersions = scopes
        .filter(({ selected }) => selected.some(({ configuration }) => configuration.name === NEXTJS_CONFIGURATION))
        .flatMap(({ scope }) => {
            const version = findInstalledDependency(root, join(scope.path, 'package.json'), NEXT_PACKAGE)?.version;
            return version === undefined ? [] : [{ scope: scope.path, major: semver.major(version) }];
        });
    const majors = new Set(nextVersions.map(({ major }) => major));
    const requirements = nextVersions
        .map(({ scope, major }) => `${scope || 'the root'} requires ^${String(major)}`)
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

/**
 * Keep Python lint dependencies in a tool project owned by gspot.
 *
 * @param manifests the selected manifests.
 *
 * @returns the Python tool project files, or none without Python tools.
 */
export function buildPythonProject(manifests: Manifest[]): GeneratedFile[] {
    const { python: dependencies } = listToolProjectPins(manifests);
    if (dependencies.length === 0) return [];
    return [
        {
            path: PYTHON_TOOL_PROJECT_FILE,
            content:
                stringify({ project: { ...PYTHON_TOOL_PROJECT, dependencies } }, TOOL_EMIT_FORMAT) +
                `\n${UV_PROJECT_TABLE}\n` +
                stringify({ package: false }, TOOL_EMIT_FORMAT),
            kind: 'tool_file',
        },
    ];
}
