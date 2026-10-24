import { JSON_INDENT } from '#cli/config/text.ts';
import { compareText } from '#cli/system/text.ts';
import { stringify } from '@decimalturn/toml-patch';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { type Configuration } from '#cli/types/configurations.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/config-files/build.ts';
import { type GeneratedFile, type PlannedNpmProject } from '#cli/types/generation/files.ts';

import {
    NPM_TOOL_PROJECT,
    UV_PROJECT_TABLE,
    PYTHON_TOOL_PROJECT,
    YARN_TOOL_PROJECT_SETTINGS,
} from '#cli/config/generation/tool-projects.ts';

/**
Build the mise tool project without the runtime pins of the repository.

@param configurations the configurations in use.

@returns the mise tool project.
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
        content: stringify({ tools }, { ...CONFIG_FILE_TOML_FORMAT, inlineTableStart: 1 }),
    };
}

/**
Build the npm tools as a tool project, and add no dependencies to the repository.

@param project what the tool project holds.
@param project.configurations the configurations with npm tools.
@param project.packageManager true for Yarn 2 or later as the repository package manager.

@returns the tool project files.
*/
export function buildNpmProject({ configurations, packageManager }: PlannedNpmProject): GeneratedFile[] {
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
    if (packageManager === 'yarn')
        files.push({
            path: GSPOT_PATHS.yarnSettings,
            content: YARN_TOOL_PROJECT_SETTINGS,
        });
    return files;
}

/**
Build the Python tool project that holds the Python lint tools.

@param configurations the configurations in use.
@param days the minimum release age, so uv installs no release newer than that.
@returns the Python tool project files, or none without Python tools.
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
