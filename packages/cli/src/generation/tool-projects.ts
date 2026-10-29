import { JSON_INDENT } from '#cli/config/text.ts';
import { compareText } from '#cli/system/text.ts';
import { stringify } from '@decimalturn/toml-patch';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildPythonProjectTable } from '#cli/installers/pypi.ts';
import { type Configuration } from '#cli/types/configurations.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/toml.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/tool-projects.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';

/**
Build the mise tool project without the runtime pins of the repository.

@param configurations the configurations in use.
*/
export function buildMiseProject(configurations: Configuration[]): GeneratedFile {
    const tools = Object.fromEntries(
        listMisePins(configurations)
            .toSorted((left, right) => compareText(left.name, right.name))
            .map((pin) => [
                pin.name,
                pin.options === undefined ? pin.version : { version: pin.version, ...pin.options },
            ]),
    );
    return {
        path: GSPOT_PATHS.miseProject,
        content: stringify(
            { tools, settings: { lockfile: true } },
            { ...CONFIG_FILE_TOML_FORMAT, inlineTableStart: 1 },
        ),
    };
}

/**
Build the npm tools as a tool project, and add no dependencies to the repository.

@param configurations the configurations with npm tools.
*/
export function buildNpmProject(configurations: Configuration[]): GeneratedFile[] {
    const pins = listToolProjectPins(configurations).npm;
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
    return files;
}

/**
Build the Python tool project that holds the Python lint tools.

@param configurations the configurations in use.
@returns an empty list without Python tools.
*/
export function buildPythonProject(configurations: Configuration[]): GeneratedFile[] {
    const project = buildPythonProjectTable(configurations);
    if (project.dependencies.length === 0) return [];
    return [
        {
            path: GSPOT_PATHS.pythonProject,
            content: stringify({ project }, CONFIG_FILE_TOML_FORMAT),
        },
    ];
}
