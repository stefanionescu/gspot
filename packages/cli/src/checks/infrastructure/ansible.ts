import { join } from 'node:path';
import { buildFinding } from '#cli/checks/finding.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { isInInstalledFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { expandCommand } from '#cli/runs/command/placeholders.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import { buildCommandSubstitutions } from '#cli/runs/command/check.ts';
import { isInScope, joinScope, listNestedScopes, findProjectFolder } from '#cli/repository/scopes.ts';
import { LINT_LINE, ANSIBLE_CONFIG_FILE, ANSIBLE_CONFIG_EXTENSION } from '#cli/config/checks/infrastructure/ansible.ts';

async function lintProject(
    session: CheckSession,
    planned: PlannedCheck,
    folder: string,
    folders: string[],
): Promise<Finding[]> {
    const children = listNestedScopes(folders, folder);
    const files = planned.files.filter(
        ({ path }) =>
            isInScope(path, folder) &&
            children.every((child) => !isInScope(path, child)) &&
            !(path.startsWith(`${GSPOT_FOLDER}/`) || isInInstalledFolder(path)) &&
            !path.endsWith(ANSIBLE_CONFIG_EXTENSION),
    );
    if (files.length === 0) return [];
    const cwd = join(session.root, folder);
    const selected = { ...planned, files };
    const substitutions = buildCommandSubstitutions(session.root, selected, cwd);
    const commandArguments = expandCommand(session, selected, planned.check.command as string[], substitutions).filter(
        (argument) => typeof argument === 'string',
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
Runs ansible-lint on each playbook project.

@param session the repository and its tools.
@param planned the scope files to lint.
@returns the findings.
*/
export async function checkAnsibleLint(session: CheckSession, planned: PlannedCheck): Promise<Finding[]> {
    const folders = listSourcePaths(planned.files, [ANSIBLE_CONFIG_FILE])
        .map((path) => findProjectFolder(path, ANSIBLE_CONFIG_FILE))
        .filter((folder) => folder !== undefined);
    const projects = folders.length > 0 ? folders : [planned.scope.path];
    const findings: Finding[] = [];
    for (const folder of projects) findings.push(...(await lintProject(session, planned, folder, projects)));
    return findings;
}
