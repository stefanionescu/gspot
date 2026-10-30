import { compareText } from '#cli/system/text.ts';
import { stringify } from '@decimalturn/toml-patch';
import { listMisePins } from '#cli/manifests/tools.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { type Configuration } from '#cli/types/manifests.ts';
import { buildPythonProjectTable } from '#cli/installers/pypi.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/toml.ts';

/**
Build the mise install of the tools, without the runtime pins of the repository.

@param configurations the configurations in use.
*/
export function buildMiseInstall(configurations: Configuration[]): GeneratedFile {
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
Build the Python install that holds the Python lint tools.

@param configurations the configurations in use.
@returns an empty list without Python tools.
*/
export function buildPythonInstall(configurations: Configuration[]): GeneratedFile[] {
    const project = buildPythonProjectTable(configurations);
    if (project.dependencies.length === 0) return [];
    return [
        {
            path: GSPOT_PATHS.pythonProject,
            content: stringify({ project }, CONFIG_FILE_TOML_FORMAT),
        },
    ];
}
