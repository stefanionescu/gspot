import { join } from 'node:path';
import { isInInstalledFolder } from '#cli/system/paths.ts';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { assertCommandCheck } from '#cli/engine/plan/checks.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { isGspotPath } from '#cli/repository/files/ownership.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import { findProjectFolder } from '#cli/repository/detection/scopes.ts';
import { expandCommand } from '#cli/engine/run/tool-runs/placeholders.ts';
import { assertToolFindings } from '#cli/engine/run/tool-runs/failures.ts';
import { buildCommandSubstitutions } from '#cli/engine/run/tool-runs/check.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';
import { isInScope, listNestedScopes, isOutsideChildScopes } from '#cli/repository/scopes.ts';
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
    assertCommandCheck(planned);
    const cwd = join(session.root, folder);
    const selected = { ...planned, files };
    const substitutions = buildCommandSubstitutions(session, session.root, selected, cwd);
    const commandArguments = expandCommand(session, selected, planned.check.command, substitutions).filter(
        (argument) => typeof argument === 'string',
    );
    const result = await runCheckTool(session, planned, commandArguments, { cwd });
    const selectedPaths = new Set(files.map(({ path }) => path));
    const found = parseOutput(planned.check, result.stdout, result.stderr, { root: session.root, cwd }).filter(
        (finding) => selectedPaths.has(finding.file),
    );
    return assertToolFindings(result, found, 'ansible-lint');
}

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
};
