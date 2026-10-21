import { join } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { isInstalledToolPath } from '#cli/repository/classify.ts';
import { expandCommand } from '#cli/runs/command/placeholders.ts';
import { buildCommandSubstitutions } from '#cli/runs/command/check.ts';
import { type Finding, type CheckInput } from '#cli/types/runs/check.ts';
import { isInScope, listNestedScopes, isOutsideChildren } from '#cli/repository/scopes.ts';
import { LINT_LINE, ANSIBLE_CFG, ANSIBLE_CONFIG_SUFFIX } from '#cli/config/checks/ansible.ts';

async function lintProject(input: CheckInput, folder: string, folders: string[]): Promise<Finding[]> {
    const children = listNestedScopes(folders, folder);
    const files = input.files.filter(
        ({ path }) =>
            isInScope(path, folder) &&
            isOutsideChildren(path, children) &&
            !isInstalledToolPath(path) &&
            !path.endsWith(ANSIBLE_CONFIG_SUFFIX),
    );
    if (files.length === 0) return [];
    const cwd = join(input.root, folder);
    const planned = { ...input, files };
    const substitutions = buildCommandSubstitutions(input, planned, cwd);
    const commandArguments = expandCommand(input, planned, input.check.command as string[], substitutions).filter(
        (part) => typeof part === 'string',
    );
    const result = await runCheckTool(input, [...commandArguments, ...substitutions.files], { cwd });
    const found = result.stdout.split('\n').flatMap((line): Finding[] => {
        const groups = LINT_LINE.exec(line)?.groups;
        if (groups === undefined) return [];
        const file = folder === '' ? (groups['file'] ?? '') : `${folder}/${groups['file'] ?? ''}`;
        return [
            buildFinding(
                input,
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
 * @param input the scope files to lint.
 * @returns the findings.
 */
export async function checkAnsibleLint(input: CheckInput): Promise<Finding[]> {
    const folders = input.files
        .map((file) => file.path)
        .filter((path) => path === ANSIBLE_CFG || path.endsWith(`/${ANSIBLE_CFG}`))
        .map((path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''));
    const projects = folders.length > 0 ? folders : [input.selection.scope.path];
    const findings: Finding[] = [];
    for (const folder of projects) findings.push(...(await lintProject(input, folder, projects)));
    return findings;
}
