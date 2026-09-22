import { MISE_CONFIG_PATH, MISE_TASKS, npmScripts } from '#cli/emit/runner-tasks.ts';
// The task runner holds the tasks gspot writes, and the hooks gspot installs are in place and call it.
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import { existsSync, readFileSync } from 'node:fs';

function finding(input: EngineInput, file: string, rule: string, text: string): Finding {
    return { check: input.spec.name, file, line: 1, rule, message: text, fixable: false };
}

function taskNames(root: string, runner: string): { file: string; names: Set<string> } {
    if (runner === 'mise') {
        const path = join(root, MISE_CONFIG_PATH);
        if (!existsSync(path)) return { file: MISE_CONFIG_PATH, names: new Set() };
        const parsed = parseToml(readFileSync(path, 'utf8')) as { tasks?: Record<string, unknown> };
        return { file: MISE_CONFIG_PATH, names: new Set(Object.keys(parsed.tasks ?? {})) };
    }
    const path = join(root, 'package.json');
    if (!existsSync(path)) return { file: 'package.json', names: new Set() };
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { scripts?: Record<string, unknown> };
    return { file: 'package.json', names: new Set(Object.keys(parsed.scripts ?? {})) };
}

function taskFindings(input: EngineInput): Finding[] {
    const runner = input.session.policyFiles.policy.runner?.tool;
    if (runner === undefined) return [];
    const required =
        runner === 'mise'
            ? MISE_TASKS.map((task) => task.name)
            : runner === 'uv'
              ? undefined
              : Object.keys(npmScripts());
    if (required === undefined) return [];
    const { file, names } = taskNames(input.root, runner);
    return required
        .filter((name) => !names.has(name))
        .map((name) =>
            finding(input, file, 'missing-task', `The ${runner} task runner has no ${name} task; run gspot apply.`),
        );
}

/**
 * Report required runner tasks. Clone-local hook installation is checked by doctor.
 * @param input the engine input
 * @returns the findings
 */
export function taskPolicy(input: EngineInput): Promise<Finding[]> {
    return Promise.resolve(taskFindings(input));
}
