import { join } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { listSourcePaths } from '#cli/repository/coverage.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { isInstalledToolPath } from '#cli/repository/classify.ts';
import { expandCommand } from '#cli/runs/command/placeholders.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { buildCommandSubstitutions } from '#cli/runs/command/check.ts';
import { LINT_LINE, ANSIBLE_CFG, ANSIBLE_CONFIG_SUFFIX } from '#cli/config/checks/ansible.ts';

import {
    joinScope,
    isInScope,
    listNestedScopes,
    findProjectFolder,
    isOutsideChildren,
} from '#cli/repository/scopes.ts';

async function lintProject(
    session: Session,
    planned: PlannedCheck,
    folder: string,
    folders: string[],
): Promise<Finding[]> {
    const children = listNestedScopes(folders, folder);
    const files = planned.files.filter(
        ({ path }) =>
            isInScope(path, folder) &&
            isOutsideChildren(path, children) &&
            !isInstalledToolPath(path) &&
            !path.endsWith(ANSIBLE_CONFIG_SUFFIX),
    );
    if (files.length === 0) return [];
    const cwd = join(session.root, folder);
    const selected = { ...planned, files };
    const substitutions = buildCommandSubstitutions(session, selected, cwd);
    const commandArguments = expandCommand(session, selected, planned.check.command as string[], substitutions).filter(
        (part) => typeof part === 'string',
    );
    const result = await runCheckTool(session, planned, [...commandArguments, ...substitutions.files], { cwd });
    const found = result.stdout.split('\n').flatMap((line): Finding[] => {
        const groups = LINT_LINE.exec(line)?.groups;
        if (groups === undefined) return [];
        const file = joinScope(folder, groups['file'] ?? '');
        return [
            buildFinding(
                planned,
                { file, line: Number(groups['line']) },
                groups['rule'] ?? 'ansible-lint',
                groups['text'] ?? '',
            ),
        ];
    });
    return assertToolFindings(result, found, 'ansible-lint');
}

/**
 * Runs ansible-lint on each playbook project.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to lint.
 * @returns the findings.
 */
export async function checkAnsibleLint(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const folders = listSourcePaths(planned.files, [ANSIBLE_CFG])
        .map((path) => findProjectFolder(path, ANSIBLE_CFG))
        .filter((folder) => folder !== undefined);
    const projects = folders.length > 0 ? folders : [planned.selection.scope.path];
    const findings: Finding[] = [];
    for (const folder of projects) findings.push(...(await lintProject(session, planned, folder, projects)));
    return findings;
}
