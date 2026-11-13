import { join, posix } from 'node:path';

import { PATH_SEPARATOR_PATTERN } from '#cli/config/configurations/language.ts';
import {
    DEPTRY_COMMAND,
    DEPTRY_EXCLUDE_FLAG,
    DEPTRY_FIRST_PARTY_FLAG,
    NO_PYPROJECT_NOTE,
    PROJECT_NAME_SEPARATORS,
    PYTHON_SOURCE_FOLDER,
    UV_RUN_ARGUMENTS,
} from '#cli/config/configurations/python.ts';
import { PYTHON_PACKAGE_FILE } from '#cli/config/configurations/shared.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { UV_FLAGS, UV_TOOL } from '#cli/config/tools/installers.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { getTool } from '#cli/manifests/read.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { deptrySchema } from '#cli/schemas/configurations.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { escapeRegExp } from '#cli/system/text.ts';
import type { DeptryProject } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckResult, CheckSession } from '#cli/types/engine/run.ts';
import type { VersionedInstaller } from '#cli/types/manifests.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';

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
Runs deptry on the scope. Passes the project's extend_exclude list again with .gspot and child scopes added, because the command-line flag replaces it.
*/
async function checkDeptry(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const pyproject = joinScope(planned.scope.path, PYPROJECT_TOML);
    const text = findText(session.cache, pyproject);
    if (text === undefined) throw new CheckStop('skipped', NO_PYPROJECT_NOTE);
    const project = parseTomlFile(pyproject, text, deptrySchema);
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
