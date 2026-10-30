import { join } from 'node:path';
import { statSync } from 'node:fs';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { getTool } from '#cli/configurations/tools.ts';
import type { ConfiguredCheck } from '#cli/types/planning.ts';
import type { ProcessFailure } from '#cli/types/tools/run.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import type { Tool, VersionedInstaller } from '#cli/types/configurations.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';

import {
    UV_TOOL,
    UV_FLAGS,
    UV_RUN_ARGUMENTS,
    INTERPRETER_FLAGS,
    PYTHON_EXECUTABLE,
    UV_PROJECT_ENVIRONMENT,
    PYTHON_ENVIRONMENT_CHECKS,
    PROJECT_ENVIRONMENT_MESSAGE,
} from '#cli/config/tools/uv.ts';

/**
List the interpreter arguments for a tool in the Python environment of a copy.

@param tool the configured Python tool.
@param environment the environment of the check.
@returns the interpreter flag and executable when the tool accepts them.
*/
export function listCopyPythonArguments(tool: Tool, environment: Record<string, string>): string[] {
    const flag = Object.hasOwn(INTERPRETER_FLAGS, tool.name) ? INTERPRETER_FLAGS[tool.name] : undefined;
    const environmentPath = environment[UV_PROJECT_ENVIRONMENT];
    return flag === undefined || environmentPath === undefined
        ? []
        : [flag, buildVenvExecutablePath(environmentPath, PYTHON_EXECUTABLE)];
}

/**
Build the command that runs a pinned Python check with the installed project dependencies of the scope.

@param scope the scope and its tools.
@param scopeRoot the project folder.
@param command the executable to run and its arguments.
@returns the uv command, which syncs neither the project nor its lockfile.
*/
export function buildUvRunCommand(scope: Scope, scopeRoot: string, command: [string, ...string[]]): string[] {
    const tool = getTool(scope.configurations, command[0]);
    const packagePin = tool.installers['pypi'] as VersionedInstaller;
    return [
        UV_TOOL,
        ...UV_RUN_ARGUMENTS,
        UV_FLAGS.project,
        scopeRoot,
        UV_FLAGS.with,
        `${packagePin.name}==${packagePin.version}`,
        ...command,
    ];
}

/**
Point the Python tools that check a copy at the environment the working tree installed. The hook checks a
pushed revision in a copy that holds no environment, after it verifies that the dependency files match.

@param roots the folder the tools check, and the working tree.
@param roots.root the folder the tools check.
@param roots.toolsRoot the working tree that holds the installed environments.
@param scopePath the project folder.
@returns UV_PROJECT_ENVIRONMENT, or nothing in the working tree or for a project without an environment.
*/
export function buildCopyPythonEnvironment(
    roots: { root: string; toolsRoot: string },
    scopePath: string,
): Record<string, string> {
    if (roots.root === roots.toolsRoot) return {};
    const environment = join(roots.toolsRoot, scopePath, PYTHON_ENVIRONMENT_FOLDER);
    return statSync(environment, { throwIfNoEntry: false })?.isDirectory() === true
        ? { [UV_PROJECT_ENVIRONMENT]: environment }
        : {};
}

/**
Require the project's Python environment before running checks that read its installed packages.

@param session the repository and installed tool folder.
@param planned the check and its project scope.
@returns the missing-environment result, or undefined when the check can run.
*/
export function findMissingProjectEnvironment(
    session: Session,
    planned: Pick<ConfiguredCheck, 'check' | 'scope'>,
): ProcessFailure | undefined {
    if (!PYTHON_ENVIRONMENT_CHECKS.has(planned.check.id)) return undefined;
    const scope = planned.scope.path;
    const project = joinScope(scope, PYPROJECT_TOML);
    if (session.repository.files.every((file) => file.path !== project)) return undefined;
    const files = openFiles(session.toolsRoot);
    return files.readStats(joinScope(scope, PYTHON_ENVIRONMENT_FOLDER))?.isDirectory() === true
        ? undefined
        : { status: 'missing', note: PROJECT_ENVIRONMENT_MESSAGE };
}
