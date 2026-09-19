// ansible-lint in every folder that holds an ansible.cfg, which is where a playbook project starts.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

const PROJECT_FILE = 'ansible.cfg';
const LINT_TIMEOUT_MS = 600_000;
const LINT_LINE = /^(?<file>[^:]+):(?<line>\d+):[\d:]* (?<rule>[^:]+): (?<text>.*)$/u;

async function linted(input: EngineInput, folder: string, skipped: string[]): Promise<Finding[]> {
    const skips = skipped.length === 0 ? [] : ['--skip-list', skipped.join(',')];
    const result = await run(['ansible-lint', '--offline', '--nocolor', '-f', 'pep8', ...skips], {
        cwd: join(input.root, folder),
        timeoutMs: LINT_TIMEOUT_MS,
    });
    if (result.missing) throw new MissingToolError('The ansible-lint command is not installed.');
    const found = result.stdout.split('\n').flatMap((line): Finding[] => {
        const groups = LINT_LINE.exec(line)?.groups;
        if (groups === undefined) return [];
        const file = folder === '' ? (groups['file'] ?? '') : `${folder}/${groups['file'] ?? ''}`;
        return [
            {
                check: input.spec.id,
                file,
                line: Number(groups['line']),
                rule: groups['rule'] ?? 'ansible-lint',
                message: groups['text'] ?? '',
                fixable: false,
            },
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
export async function ansibleLint(input: EngineInput): Promise<Finding[]> {
    const folders = input.session.repository.files
        .map((file) => file.path)
        .filter((path) => path === PROJECT_FILE || path.endsWith(`/${PROJECT_FILE}`))
        .map((path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''));
    const skipped = input.view.rulesOff(input.spec.id);
    const findings: Finding[] = [];
    for (const folder of folders) findings.push(...(await linted(input, folder, skipped)));
    return findings;
}
