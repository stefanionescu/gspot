import { join } from 'node:path';
import { statSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { getTool } from '#cli/configurations/tools.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';

import {
    UV_TOOL,
    UV_PROJECT_FLAGS,
    UV_RUN_ARGUMENTS,
    INTERPRETER_FLAGS,
    PYTHON_EXECUTABLE,
    UV_ENVIRONMENT_VARIABLE,
} from '#cli/config/tools/python.ts';

/**
 * List the interpreter arguments for a tool in the Python environment of a copy.
 *
 * @param tool the configured Python tool.
 * @param env the environment of the check.
 * @returns the interpreter flag and executable when the tool accepts them.
 */
export function listCopyPythonArguments(tool: Tool, env: Record<string, string>): string[] {
    const flag = Object.hasOwn(INTERPRETER_FLAGS, tool.name) ? INTERPRETER_FLAGS[tool.name] : undefined;
    const environment = env['UV_PROJECT_ENVIRONMENT'];
    return flag === undefined || environment === undefined
        ? []
        : [flag, buildVenvExecutablePath(environment, PYTHON_EXECUTABLE)];
}

/**
 * Build the command that runs a pinned Python check with the installed project dependencies of the scope.
 *
 * @param scope the scope and its tools.
 * @param scopeRoot the project folder.
 * @param command the executable to run and its arguments.
 * @returns the uv command, which syncs neither the project nor its lockfile.
 */
export function buildUvRunCommand(scope: Scope, scopeRoot: string, command: [string, ...string[]]): string[] {
    const tool = getTool(scope.configurations, command[0]);
    const packagePin = tool.installers['pypi'];
    if (packagePin?.version === undefined)
        throw new GspotError('tool', `The ${tool.name} check names no pinned Python package in its manifest.`);
    return [
        UV_TOOL,
        ...UV_RUN_ARGUMENTS,
        UV_PROJECT_FLAGS.project,
        scopeRoot,
        '--with',
        `${packagePin.name}==${packagePin.version}`,
        ...command,
    ];
}

/**
 * Point the Python tools that check a copy at the environment the working tree installed. The hook checks a
 * pushed revision in a copy that holds no environment, after it verifies that the dependency files match.
 *
 * @param roots the folder the tools check, and the working tree.
 * @param roots.root the folder the tools check.
 * @param roots.installedRoot the working tree that holds the installed environments.
 * @param scope the project folder.
 * @returns UV_PROJECT_ENVIRONMENT, or nothing in the working tree or for a project without an environment.
 */
export function buildCopyPythonEnvironment(
    roots: { root: string; installedRoot: string },
    scope: string,
): Record<string, string> {
    if (roots.root === roots.installedRoot) return {};
    const environment = join(roots.installedRoot, scope, PYTHON_ENVIRONMENT_FOLDER);
    return statSync(environment, { throwIfNoEntry: false })?.isDirectory() === true
        ? { [UV_ENVIRONMENT_VARIABLE]: environment }
        : {};
}
