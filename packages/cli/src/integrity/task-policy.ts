// The task runner holds the tasks gspot writes, and the hooks gspot installs are in place and call it.
import { join } from 'node:path';
import { git } from '#cli/platform/spawn.ts';
import { parse as parseToml } from 'smol-toml';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import { HOOK_FILES, REQUIRED_TASKS } from '#config/integrity.ts';

const MISE_FILE = '.config/mise/conf.d/gspot.toml';
const HOOKS_DIRECTORY = '.gspot/hooks';

function finding(input: EngineInput, file: string, rule: string, text: string): Finding {
    return { check: input.spec.name, file, line: 1, rule, message: text, fixable: false };
}

function taskNames(root: string, runner: string): { file: string; names: Set<string> } {
    if (runner === 'mise') {
        const path = join(root, MISE_FILE);
        if (!existsSync(path)) return { file: MISE_FILE, names: new Set() };
        const parsed = parseToml(readFileSync(path, 'utf8')) as { tasks?: Record<string, unknown> };
        return { file: MISE_FILE, names: new Set(Object.keys(parsed.tasks ?? {})) };
    }
    const path = join(root, 'package.json');
    if (!existsSync(path)) return { file: 'package.json', names: new Set() };
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { scripts?: Record<string, unknown> };
    return { file: 'package.json', names: new Set(Object.keys(parsed.scripts ?? {})) };
}

function taskFindings(input: EngineInput): Finding[] {
    const runner = input.session.policyFiles.policy.runner.tool;
    const required = REQUIRED_TASKS[runner];
    if (required === undefined) return [];
    const { file, names } = taskNames(input.root, runner);
    return required
        .filter((name) => !names.has(name))
        .map((name) =>
            finding(input, file, 'missing-task', `The ${runner} task runner has no ${name} task; run gspot apply.`),
        );
}

function hookFindings(input: EngineInput): Finding[] {
    if (input.session.policyFiles.policy.hooks.tool !== 'gspot') return [];
    const missing = HOOK_FILES.filter((name) => {
        const path = join(input.root, HOOKS_DIRECTORY, name);
        return !existsSync(path) || !readFileSync(path, 'utf8').includes('gspot');
    }).map((name) =>
        finding(
            input,
            `${HOOKS_DIRECTORY}/${name}`,
            'missing-hook',
            `The ${name} hook is missing or does not call gspot; run gspot apply.`,
        ),
    );
    const hooksPath = git(input.root, ['config', 'core.hooksPath'])?.trim();
    const isPointed = hooksPath === HOOKS_DIRECTORY;
    return isPointed
        ? missing
        : [
              ...missing,
              finding(
                  input,
                  HOOKS_DIRECTORY,
                  'hooks-path',
                  `core.hooksPath is ${hooksPath === undefined || hooksPath === '' ? 'unset' : hooksPath}, not ${HOOKS_DIRECTORY}; run gspot apply.`,
              ),
          ];
}

/**
 * One finding per required task the task runner lacks and per hook that is missing, silent or not pointed at.
 * @param input the engine input
 * @returns the findings
 */
export function taskPolicy(input: EngineInput): Promise<Finding[]> {
    return Promise.resolve([...taskFindings(input), ...hookFindings(input)]);
}
