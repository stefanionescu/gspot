import { stringify } from '@decimalturn/toml-patch';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import {
    CONFIG_TOML_FORMAT,
    JSON_INDENT,
    NPM_TOOL_PROJECT,
    PYTHON_TOOL_PROJECT,
} from '#cli/config/tools/installers.ts';
import { compareText } from '#cli/system/text/order.ts';
import { listMisePins, listNpmProjectPins, listPackagePins } from '#cli/tools/pins.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { GeneratedFile, PythonToolProject, Session } from '#cli/types/tools.ts';

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
        content: stringify({ tools }, { ...CONFIG_TOML_FORMAT, inlineTableStart: 1 }),
    };
}

export function buildPythonProjectTable(configurations: Configuration[]): PythonToolProject {
    return { ...PYTHON_TOOL_PROJECT, dependencies: listPackagePins(configurations).python };
}

export function buildToolProjects(
    session: Pick<Session, 'packageManager' | 'scopes' | 'toolConfigurations'>,
): GeneratedFile[] {
    const { packageManager, toolConfigurations } = session;
    const project = { ...NPM_TOOL_PROJECT, devDependencies: listNpmProjectPins(session) };
    const npmProject = { path: GSPOT_PATHS.npmProject, content: `${JSON.stringify(project, null, JSON_INDENT)}\n` };
    const python = buildPythonProjectTable(toolConfigurations);
    const pythonContent = stringify({ project: python }, CONFIG_TOML_FORMAT);
    return [
        ...(packageManager === undefined ? [] : [npmProject]),
        ...(python.dependencies.length === 0 ? [] : [{ path: GSPOT_PATHS.pythonProject, content: pythonContent }]),
        buildMiseInstall(toolConfigurations),
    ];
}
