import { join, relative } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { isInScope } from '#cli/repository/paths/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { runCheckTool } from '#cli/execution/command/public.ts';
import { toolOutputDetail } from '#cli/execution/command/contracts.ts';
import { LINT_LINE, ANSIBLE_PROJECT_FILE } from '#cli/config/checks/tool/ansible.ts';

async function lintProject(input: CheckInput, folder: string, skipped: string[]): Promise<Finding[]> {
    const skips = skipped.length === 0 ? [] : ['--skip-list', skipped.join(',')];
    const files = input.files
        .filter(({ path }) => isInScope(path, folder) && !path.endsWith('.cfg'))
        .map(({ path }) => relative(folder, path));
    if (files.length === 0) return [];
    const result = await runCheckTool(
        input,
        ['ansible-lint', '--offline', '--nocolor', '-f', 'pep8', ...skips, ...files],
        {
            cwd: join(input.root, folder),
        },
    );
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
    if (result.code !== 0 && found.length === 0)
        throw new Error(
            `The ansible-lint command failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    return found;
}

/**
 * The ansible-lint findings of every playbook project in the repository.
 * @param input the check input
 * @returns the findings
 */
export async function ansibleLint(input: CheckInput): Promise<Finding[]> {
    const folders = input.files
        .map((file) => file.path)
        .filter((path) => path === ANSIBLE_PROJECT_FILE || path.endsWith(`/${ANSIBLE_PROJECT_FILE}`))
        .map((path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''));
    const skipped = [
        ...input.view.rulesOff(input.check.name),
        'experimental',
        ...(input.policyFiles.policy.level === 'all'
            ? []
            : ['name', 'var-naming', 'loop-var-prefix', 'key-order', 'fqcn', 'no-handler', 'no-relative-paths']),
    ];
    const findings: Finding[] = [];
    for (const folder of folders.length > 0 ? folders : [input.scope])
        findings.push(...(await lintProject(input, folder, skipped)));
    return findings;
}
