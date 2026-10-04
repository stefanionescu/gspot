import { join } from 'node:path';
import { findingAt } from '#cli/execution/finding.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { LINT_LINE, ANSIBLE_PROJECT_FILE } from '#cli/config/checks/tool/ansible.ts';

async function linted(input: EngineInput, folder: string, skipped: string[]): Promise<Finding[]> {
    const skips = skipped.length === 0 ? [] : ['--skip-list', skipped.join(',')];
    const result = await runEngineTool(input, ['ansible-lint', '--offline', '--nocolor', '-f', 'pep8', ...skips], {
        cwd: join(input.root, folder),
    });
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
        throw new Error(`The ansible-lint command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    return found;
}

/**
 * The ansible-lint findings of every playbook project in the repository.
 * @param input the engine input
 * @returns the findings
 */
export async function lint(input: EngineInput): Promise<Finding[]> {
    const folders = input.files
        .map((file) => file.path)
        .filter((path) => path === ANSIBLE_PROJECT_FILE || path.endsWith(`/${ANSIBLE_PROJECT_FILE}`))
        .map((path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''));
    const skipped = [
        ...input.view.rulesOff(input.spec.name),
        'experimental',
        ...(input.policyFiles.policy.level === 'all'
            ? []
            : ['name', 'var-naming', 'loop-var-prefix', 'key-order', 'fqcn', 'no-handler', 'no-relative-paths']),
    ];
    const findings: Finding[] = [];
    for (const folder of folders) findings.push(...(await linted(input, folder, skipped)));
    return findings;
}
