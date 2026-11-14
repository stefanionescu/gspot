import { join, posix } from 'node:path';
import { getTool } from '#cli/manifests/tools.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { getTable } from '#cli/settings/tables.ts';
import type { Session } from '#cli/types/tools.ts';
import type { Scope } from '#cli/types/settings.ts';
import { escapeRegExp } from '#cli/system/patterns.ts';
import { UV_FLAGS } from '#cli/config/tools/installers.ts';
import { deptrySchema } from '#cli/schemas/configurations.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { UV_PROGRAM, GSPOT_FOLDER } from '#cli/config/system.ts';
import type { VersionedInstaller } from '#cli/types/manifests.ts';
import { runCommandCheck } from '#cli/engine/run/tool-runs/check.ts';
import { joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { PYTHON_PACKAGE_FILE } from '#cli/config/configurations/shared.ts';
import type { DeptryProject } from '#cli/types/configurations/language.ts';
import { PATH_SEPARATOR_PATTERN } from '#cli/config/configurations/language.ts';
import { readPyproject } from '#cli/configurations/language/python/pyproject.ts';
import type { CheckCode, CheckResult, CheckSession } from '#cli/types/engine/run.ts';

import {
    DEPTRY_COMMAND,
    UV_RUN_ARGUMENTS,
    NO_PYPROJECT_NOTE,
    DEPTRY_EXCLUDE_FLAG,
    PYTHON_SOURCE_FOLDER,
    DEPTRY_FIRST_PARTY_FLAG,
    PROJECT_NAME_SEPARATORS,
} from '#cli/config/configurations/python.ts';

function listFirstPartyPackages(session: Session, planned: PlannedCheck, project: DeptryProject): string[] {
    const sources = joinScope(planned.scope.path, PYTHON_SOURCE_FOLDER);
    const packages = session.repository.files
        .map(({ path }) => path)
        .filter((path) => posix.basename(path) === PYTHON_PACKAGE_FILE)
        .map((path) => posix.dirname(path))
        .filter((folder) => posix.dirname(folder) === sources)
        .map((folder) => posix.basename(folder));
    const projectName = project.project.name?.toLowerCase().replaceAll(PROJECT_NAME_SEPARATORS, '_');
    return [
        ...new Set([
            ...(projectName === undefined ? [] : [projectName]),
            ...packages,
            ...project.tool.deptry.known_first_party,
            ...getTable(planned.scope.settings, 'python').externals,
        ]),
    ].flatMap((module) => [DEPTRY_FIRST_PARTY_FLAG, module]);
}

/**
Build the command that runs a pinned Python check with the installed project dependencies of the scope.

@returns the uv command, which syncs neither the project nor its lockfile.
*/
function buildUvRunCommand(scope: Scope, scopeRoot: string, command: [string, ...string[]]): string[] {
    const tool = getTool(scope.configurations, command[0]);
    const packagePin = tool.installers.pypi as VersionedInstaller;
    return [
        UV_PROGRAM,
        ...UV_RUN_ARGUMENTS,
        UV_FLAGS.project,
        scopeRoot,
        UV_FLAGS.with,
        `${packagePin.name}==${packagePin.version}`,
        ...command,
    ];
}

/**
Runs deptry on the scope. Passes the project's extend_exclude list again with .gspot and child scopes added, because the command-line flag replaces it.
*/
async function checkDeptry(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const project = readPyproject(session.cache, planned.scope.path, deptrySchema);
    if (project === undefined) throw new CheckStop('skipped', NO_PYPROJECT_NOTE);
    const excluded = [
        String.raw`(^|.*[/\\])${escapeRegExp(GSPOT_FOLDER)}([/\\]|$)`,
        ...listNestedScopes(
            session.scopes.map((scope) => scope.path),
            planned.scope.path,
        ).map((path) => {
            const child = posix
                .relative(planned.scope.path, path)
                .split('/')
                .map((segment) => escapeRegExp(segment))
                .join(PATH_SEPARATOR_PATTERN);
            return String.raw`^${child}([/\\]|$)`;
        }),
        ...project.tool.deptry.extend_exclude,
    ];
    return await runCommandCheck(session, planned, {
        command: buildUvRunCommand(planned.scope, join(session.root, planned.scope.path), [
            ...DEPTRY_COMMAND,
            ...excluded.flatMap((pattern) => [DEPTRY_EXCLUDE_FLAG, pattern]),
            ...listFirstPartyPackages(session, planned, project),
        ]),
    });
}

export const PYTHON_DEPTRY_CHECKS: Readonly<Record<string, CheckCode>> = {
    'python/deptry': { run: checkDeptry },
};
