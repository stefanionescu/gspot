import { join } from 'node:path';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { assertToolFindings } from '#cli/engine/tool-runs/output.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import { expandCommand } from '#cli/engine/tool-runs/placeholders.ts';
import { isInScope, isInInstalledFolder } from '#cli/system/paths.ts';
import { buildCommandSubstitutions } from '#cli/engine/tool-runs/check.ts';
import { type CheckCode, type CheckSession } from '#cli/types/engine/run.ts';
import { listNestedScopes, findProjectFolder, isOutsideChildScopes } from '#cli/repository/scopes.ts';
import { ANSIBLE_CONFIG_FILE, ANSIBLE_CONFIG_EXTENSION } from '#cli/config/configurations/infrastructure.ts';

async function lintProject(
    session: CheckSession,
    planned: PlannedCheck,
    folder: string,
    folders: string[],
): Promise<CheckFinding[]> {
    const children = listNestedScopes(folders, folder);
    const files = planned.files.filter(
        ({ path }) =>
            isInScope(path, folder) &&
            isOutsideChildScopes(path, children) &&
            !(isGspotPath(path) || isInInstalledFolder(path)) &&
            !path.endsWith(ANSIBLE_CONFIG_EXTENSION),
    );
    if (files.length === 0) return [];
    const cwd = join(session.root, folder);
    const selected = { ...planned, files };
    const substitutions = buildCommandSubstitutions(session.root, selected, cwd, session.selection?.messageFile);
    const commandArguments = expandCommand(session, selected, planned.check.command as string[], substitutions).filter(
        (argument) => typeof argument === 'string',
    );
    const result = await runCheckTool(session, planned, commandArguments, { cwd });
    const selectedPaths = new Set(files.map(({ path }) => path));
    const found = parseOutput(planned.check, result.stdout, result.stderr, { root: session.root, cwd }).filter(
        (finding) => selectedPaths.has(finding.file),
    );
    return assertToolFindings(result, found, 'ansible-lint');
}

/**
Runs ansible-lint on each playbook project.

@param session the repository and its tools.
@param planned the scope files to lint.
*/
async function checkAnsibleLint(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const folders = listSourcePaths(planned.files, [ANSIBLE_CONFIG_FILE])
        .map((path) => findProjectFolder(path, ANSIBLE_CONFIG_FILE))
        .filter((folder) => folder !== undefined);
    const projects = folders.length > 0 ? folders : [planned.scope.path];
    const findings: CheckFinding[] = [];
    for (const folder of projects) findings.push(...(await lintProject(session, planned, folder, projects)));
    return findings;
}

export const ANSIBLE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'ansible/ansible-lint': { check: checkAnsibleLint },
    'ansible/ansible-lint-production': { check: checkAnsibleLint },
};
