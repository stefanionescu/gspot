import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import type { FileObservation } from '#cli/types/platform.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import type { RunnerTaskNames } from '#cli/types/policy/policy.ts';
import type { Field, KeyPath } from '#cli/types/lifecycle/lifecycle.ts';
import { RUNNER_TASKS, PACKAGE_LIFECYCLE } from '#cli/config/policy/policy.ts';
import type { RunnerPlan, ConfigurationOutput } from '#cli/types/generation.ts';

function readRunnerTasks(
    root: string,
    runner: string,
): { path: string; source?: FileObservation; tasks: Record<string, unknown> } {
    const path = runner === 'mise' ? 'mise.toml' : 'package.json';
    const files = openConfinedRoot(root);
    let source;
    try {
        source = files.read(path);
    } finally {
        files.close();
    }
    let document: unknown = {};
    if (source !== undefined)
        document =
            runner === 'mise' ? parseToml(source.bytes.toString('utf8')) : JSON.parse(source.bytes.toString('utf8'));
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

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Its callers sit at the complexity or length limit; inlining the expression pushes them over.
function ownedTaskFields(root: string, path: string): Field[] {
    return readOwnership(root).files.find((entry) => entry.path === path)?.configuration?.fields ?? [];
}

// An existing unowned task needs consent unless it already contains the proposed command.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Its callers sit at the complexity or length limit; inlining the expression pushes them over.
function needsConsent(
    body: unknown,
    expected: string,
    accepted: string | undefined,
    previous: Field | undefined,
): boolean {
    return accepted === undefined && previous === undefined && !isDeepStrictEqual(body, expected);
}

function miseTaskValue(name: string, value: unknown, previous: Field | undefined): { path: KeyPath; body: unknown } {
    if (value !== null && typeof value === 'object')
        return { path: previous?.path ?? ['tasks', name, 'run'], body: (value as Record<string, unknown>)['run'] };
    return { path: previous?.path ?? ['tasks', name], body: value };
}

function miseTaskPlan(root: string, names: RunnerTaskNames): RunnerPlan {
    const { path, tasks: authored } = readRunnerTasks(root, 'mise');
    const owned = ownedTaskFields(root, path);
    const plans = RUNNER_TASKS.map((task) => {
        const accepted = names[task.key];
        const name = accepted ?? task.name;
        const value = Object.hasOwn(authored, name) ? authored[name] : undefined;
        const previous = owned.find((entry) => entry.path[0] === 'tasks' && entry.path[1] === name);
        const field = miseTaskValue(name, value, previous);
        if (value !== undefined && needsConsent(field.body, task.run, accepted, previous)) {
            return { note: `Retained ${path} task ${name}: this name was not accepted in runner.tasks.` };
        }
        if (value === undefined) return { task: { ...task, name } };
        return { change: { path: field.path, value: task.run } };
    });
    const configuration: ConfigurationOutput = {
        path,
        format: 'toml',
        changes: plans.flatMap((plan) => (plan.change === undefined ? [] : [plan.change])),
    };
    return {
        tasks: plans.flatMap((plan) => (plan.task === undefined ? [] : [plan.task])),
        notes: plans.flatMap((plan) => (plan.note === undefined ? [] : [plan.note])),
        ...(configuration.changes.length === 0 ? {} : { configuration }),
    };
}

function packageTaskPlan(root: string, names: RunnerTaskNames): RunnerPlan {
    const { path, source, tasks: authored } = readRunnerTasks(root, 'npm');
    if (source === undefined) return { tasks: [], notes: ['No package.json exists for runner tasks.'] };
    const owned = ownedTaskFields(root, path);
    const forbidden = new Set([
        ...PACKAGE_LIFECYCLE,
        ...Object.keys(authored).flatMap((name) => [`pre${name}`, `post${name}`]),
    ]);
    const plans = RUNNER_TASKS.map((task) => {
        const accepted = names[task.key];
        const name = accepted ?? task.name;
        if (forbidden.has(name))
            throw new Error(`Runner task ${name} is a package lifecycle script and cannot be replaced.`);
        const value = Object.hasOwn(authored, name) ? authored[name] : undefined;
        const previous = owned.find((entry) => entry.path[0] === 'scripts' && entry.path[1] === name);
        if (value !== undefined && needsConsent(value, task.run, accepted, previous)) {
            return { note: `Retained ${path} task ${name}: this name was not accepted in runner.tasks.` };
        }
        return { change: { path: previous?.path ?? ['scripts', name], value: task.run } };
    });
    const configuration: ConfigurationOutput = {
        path,
        format: 'json',
        changes: plans.flatMap((plan) => (plan.change === undefined ? [] : [plan.change])),
    };
    return {
        tasks: [],
        notes: plans.flatMap((plan) => (plan.note === undefined ? [] : [plan.note])),
        ...(configuration.changes.length === 0 ? {} : { configuration }),
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
): { names: RunnerTaskNames; observed: Map<string, FileObservation> } {
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
export function runnerTaskPlan(root: string, runner: string, names: RunnerTaskNames = {}): RunnerPlan {
    if (runner === 'mise') return miseTaskPlan(root, names);
    if (['npm', 'pnpm', 'yarn', 'bun'].includes(runner)) return packageTaskPlan(root, names);
    if (Object.keys(names).length > 0) throw new Error(`${runner} does not support task mappings.`);
    return { tasks: [], notes: [] };
}
