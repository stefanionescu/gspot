import { join } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { isToolingPath } from '#cli/repository/classify.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { toolFindings } from '#cli/execution/command/output.ts';
import { substitute } from '#cli/execution/command/placeholders.ts';
import { commandSubstitutions } from '#cli/execution/command/check.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { LINT_LINE, ANSIBLE_CFG, ANSIBLE_CONFIG_SUFFIX } from '#cli/config/checks/infrastructure/ansible.ts';

async function lintProject(input: CheckInput, folder: string): Promise<Finding[]> {
    const files = input.files.filter(
        ({ path }) => isInScope(path, folder) && !isToolingPath(path) && !path.endsWith(ANSIBLE_CONFIG_SUFFIX),
    );
    if (files.length === 0) return [];
    const cwd = join(input.root, folder);
    const planned = { check: input.check, scope: input.selection, files };
    const substitutions = commandSubstitutions(input, planned, cwd);
    const argv = substitute(input, planned, input.check.command as string[], substitutions).filter(
        (part) => typeof part === 'string',
    );
    const result = await runCheckTool(input, [...argv, ...substitutions.files], { cwd });
    const found = result.stdout.split('\n').flatMap((line): Finding[] => {
        const groups = LINT_LINE.exec(line)?.groups;
        if (groups === undefined) return [];
        const file = folder === '' ? (groups['file'] ?? '') : `${folder}/${groups['file'] ?? ''}`;
        return [
            findingAt(
                input,
                { file, line: Number(groups['line']) },
                groups['rule'] ?? 'ansible-lint',
                groups['text'] ?? '',
            ),
        ];
    });
    return toolFindings(result, found, 'ansible-lint');
}

/**
 * The ansible-lint findings of every playbook project in the repository.
 * @param input the check input.
 * @returns the findings.
 */
export async function ansibleLint(input: CheckInput): Promise<Finding[]> {
    const folders = input.files
        .map((file) => file.path)
        .filter((path) => path === ANSIBLE_CFG || path.endsWith(`/${ANSIBLE_CFG}`))
        .map((path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''));
    const findings: Finding[] = [];
    for (const folder of folders.length > 0 ? folders : [input.selection.scope.path])
        findings.push(...(await lintProject(input, folder)));
    return findings;
}
