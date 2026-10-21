import { join } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { expandCommand } from '#cli/runs/command/placeholders.ts';
import { listSourcePaths } from '#cli/repository/covered-files.ts';
import { buildCommandSubstitutions } from '#cli/runs/command/check.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';
import { isInScope, joinScope, listNestedScopes, findProjectFolder } from '#cli/repository/scopes.ts';
import { LINT_LINE, ANSIBLE_CONFIG_FILE, ANSIBLE_CONFIG_EXTENSION } from '#cli/config/checks/ansible.ts';

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
            children.every((child) => !isInScope(path, child)) &&
            !(
                path.startsWith(`${DOT_GSPOT}/`) ||
                path.split('/').some((part) => INSTALLED_DEPENDENCY_FOLDERS.has(part))
            ) &&
            !path.endsWith(ANSIBLE_CONFIG_EXTENSION),
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
    const folders = listSourcePaths(planned.files, [ANSIBLE_CONFIG_FILE])
        .map((path) => findProjectFolder(path, ANSIBLE_CONFIG_FILE))
        .filter((folder) => folder !== undefined);
    const projects = folders.length > 0 ? folders : [planned.scope.folder.path];
    const findings: Finding[] = [];
    for (const folder of projects) findings.push(...(await lintProject(session, planned, folder, projects)));
    return findings;
}
