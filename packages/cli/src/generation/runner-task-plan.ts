import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import type { FileSnapshot } from '#cli/types/platform.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { ConfigurationOutput } from '#cli/types/generation.ts';
import type { RunnerTask, RunnerTaskNames } from '#cli/types/policy/policy.ts';
import { PACKAGE_LIFECYCLE, RUNNER_TASKS } from '#cli/constants/policy/policy.ts';

function readRunnerTasks(
    root: string,
    runner: string,
): { path: string; source?: FileSnapshot; tasks: Record<string, unknown> } {
    const path = runner === 'mise' ? 'mise.toml' : 'package.json';
    const files = openConfinedRoot(root);
    let source;
    try {
        source = files.read(path);
    } finally {
        files.close();
    }
    const document: unknown =
        source === undefined
            ? {}
            : runner === 'mise'
              ? parseToml(source.bytes.toString('utf8'))
              : JSON.parse(source.bytes.toString('utf8'));
    const entries = z
        .object({
            tasks: z.record(z.string(), z.unknown()).optional(),
            scripts: z.record(z.string(), z.string()).optional(),
        })
        .parse(document);
    return {
        path,
        ...(source === undefined ? {} : { source }),
        tasks: (runner === 'mise' ? entries.tasks : entries.scripts) ?? {},
    };
}

/**
 * Propose existing check and format names and retain the exact input reviewed during init.
 * @param root the repository root
 * @param runner the task runner
 * @returns the task names found and the runner file as it was read
 */
export function proposedRunnerTasks(
    root: string,
    runner: string,
): { names: RunnerTaskNames; observed: Map<string, FileSnapshot> } {
    if (!['mise', 'npm', 'pnpm', 'yarn', 'bun'].includes(runner)) return { names: {}, observed: new Map() };
    const { path, source, tasks } = readRunnerTasks(root, runner);
    const check = ['lint', 'check'].find((name) => Object.hasOwn(tasks, name));
    const fix = ['format', 'check:fix', 'fix'].find((name) => Object.hasOwn(tasks, name));
    return {
        names: { ...(check === undefined ? {} : { check }), ...(fix === undefined ? {} : { fix }) },
        observed: new Map(source === undefined ? [] : [[path, source]]),
    };
}

/**
 * Plan accepted task bodies without replacing unaccepted names or package lifecycle scripts.
 * @param root the repository root
 * @param runner the task runner
 * @param names the task names the policy maps to gspot commands
 * @returns the tasks to write, the shared configuration they go into, and notes about what stays
 */
export function runnerTaskPlan(
    root: string,
    runner: string,
    names: RunnerTaskNames = {},
): {
    tasks: RunnerTask[];
    configuration?: ConfigurationOutput;
    notes: string[];
} {
    const isMise = runner === 'mise';
    if (!isMise && !['npm', 'pnpm', 'yarn', 'bun'].includes(runner)) {
        if (Object.keys(names).length > 0) throw new Error(`${runner} does not support task mappings.`);
        return { tasks: [], notes: [] };
    }
    const { path, source, tasks: authored } = readRunnerTasks(root, runner);
    if (!isMise && source === undefined) return { tasks: [], notes: ['No package.json exists for runner tasks.'] };
    const owned = readOwnership(root).files.find((entry) => entry.path === path)?.configuration?.fields ?? [];
    const configuration: ConfigurationOutput = { path, format: isMise ? 'toml' : 'json', changes: [] };
    const tasks: RunnerTask[] = [];
    const notes: string[] = [];
    for (const task of RUNNER_TASKS) {
        const accepted = names[task.key];
        const name = accepted ?? task.name;
        if (
            !isMise &&
            (PACKAGE_LIFECYCLE.includes(name) ||
                Object.keys(authored).some((script) => name === `pre${script}` || name === `post${script}`))
        )
            throw new Error(`Runner task ${name} is a package lifecycle script and cannot be replaced.`);
        const value = Object.hasOwn(authored, name) ? authored[name] : undefined;
        const previous = owned.find(
            (entry) => entry.path[0] === (isMise ? 'tasks' : 'scripts') && entry.path[1] === name,
        );
        const field = previous?.path ?? [
            isMise ? 'tasks' : 'scripts',
            name,
            ...(isMise && value !== undefined && typeof value === 'object' && value !== null ? ['run'] : []),
        ];
        const body =
            isMise && value !== null && typeof value === 'object' ? (value as Record<string, unknown>)['run'] : value;
        if (
            accepted === undefined &&
            value !== undefined &&
            previous === undefined &&
            !isDeepStrictEqual(body, task.run)
        ) {
            notes.push(`Retained ${path} task ${name}: this name was not accepted in runner.tasks.`);
            continue;
        }
        if (isMise && value === undefined) tasks.push({ ...task, name });
        else configuration.changes.push({ path: field, value: task.run });
    }
    return { tasks, notes, ...(configuration.changes.length === 0 ? {} : { configuration }) };
}
