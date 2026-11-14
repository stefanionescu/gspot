import { join } from 'node:path';
import { statSync } from 'node:fs';
import type { Tool } from '#cli/types/manifests.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { executableLayout } from '#cli/system/processes/programs.ts';
import { UV_PROJECT_ENVIRONMENT } from '#cli/config/tools/installers.ts';
import { PYTHON_EXECUTABLE, ACTIVE_ENVIRONMENT_VARIABLE } from '#cli/config/tools/programs.ts';

/**
Find the Python environment that the shell activated. Poetry, pip-tools, and conda keep it outside the project folder.
*/
export function findActiveEnvironment(): string | undefined {
    const active = readEnvironmentVariable(ACTIVE_ENVIRONMENT_VARIABLE);
    if (active === undefined || active === '') return undefined;
    return statSync(active, { throwIfNoEntry: false })?.isDirectory() === true ? active : undefined;
}

export function listCopyPythonArguments(tool: Tool, environment: Record<string, string>): string[] {
    const environmentPath = environment[UV_PROJECT_ENVIRONMENT];
    const flag = tool.interpreter_flag;
    if (flag === undefined || environmentPath === undefined) return [];
    return [
        flag,
        join(
            environmentPath,
            executableLayout.environmentFolder,
            PYTHON_EXECUTABLE + executableLayout.environmentSuffix,
        ),
    ];
}

/**
Point the Python tools at the environment that VIRTUAL_ENV names, before the .venv of the project. Without one, point
the tools that check a copy at the environment the working tree installed. The hook checks a pushed revision in a copy
that holds no environment, after it verifies that the dependency files match.
*/
export function buildCopyPythonEnvironment(
    roots: { root: string; toolsRoot: string },
    scopePath: string,
): Record<string, string> {
    const active = findActiveEnvironment();
    if (active !== undefined) return { [UV_PROJECT_ENVIRONMENT]: active };
    if (roots.root === roots.toolsRoot) return {};
    const environment = join(roots.toolsRoot, scopePath, PYTHON_ENVIRONMENT_FOLDER);
    return statSync(environment, { throwIfNoEntry: false })?.isDirectory() === true
        ? { [UV_PROJECT_ENVIRONMENT]: environment }
        : {};
}
