import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { headerFor } from '#cli/emit/templates.ts';
import { PACKAGE_LIFECYCLE } from '#cli/policy/runner.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import type { RunnerTaskNames } from '#cli/policy/runner.ts';
// Mise tool pins and task definitions; npm tools belong to the isolated package project.
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import type { ConfigurationOutput, GeneratedFile } from '#cli/emit/targets.ts';
import type { Manifest, ToolPin, InstallerPin } from '#cli/configurations/read-manifests.ts';
import { MISE_BACKENDS, UV_INSTALLER, collectPins, privateToolInstallation } from '#cli/tools/tool-installation.ts';

const HOST_ONLY = new Set(['bash', 'git', 'docker', 'xcodebuild', 'plutil', 'xcstringstool', 'swift', 'xmllint']);
const BARE_KEY = /^[\w-]+$/u;
const MISE_CONFIG_PATH = '.mise/conf.d/gspot-tools.toml';
const MISE_MIN_VERSION = '2026.8.8';
const RUNNER_TASKS: (RunnerTask & { key: keyof RunnerTaskNames })[] = [
    { key: 'check', name: 'gspot:check', description: 'Run selected checks', run: 'gspot check' },
    { key: 'fix', name: 'gspot:fix', description: 'Apply corrections and check again', run: 'gspot check --fix' },
    { key: 'apply', name: 'gspot:apply', description: 'Generate configuration from gspot.toml', run: 'gspot apply' },
    {
        key: 'doctor',
        name: 'gspot:doctor',
        description: 'Report tools, coverage, and configuration changes',
        run: 'gspot doctor',
    },
];

type RunnerTask = { name: string; description: string; run: string };

function tomlKey(name: string): string {
    return BARE_KEY.test(name) ? name : JSON.stringify(name);
}

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
    const document =
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
 * @param root
 * @param runner
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
 * @param root
 * @param runner
 * @param names
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
            (PACKAGE_LIFECYCLE.has(name) ||
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

/**
 * The mise package and version, using the backend the manifest names.
 * @param tool the pin
 * @returns the installer pin with its backend prefix, or undefined for a host tool
 */
export function misePin(tool: ToolPin): InstallerPin | undefined {
    if (tool.provider === 'host' || HOST_ONLY.has(tool.name)) return undefined;
    const backend = MISE_BACKENDS.find(({ installer }) => tool.installers[installer] !== undefined);
    if (backend === undefined) return undefined;
    const pin = tool.installers[backend.installer];
    return pin === undefined ? undefined : { ...pin, name: `${backend.prefix}${pin.name}` };
}

/**
 * Select only the tools installed by mise, excluding npm dependencies of the private project.
 * @param manifests the selected manifests
 * @param isPackagePinned whether npm tools belong to the isolated package project
 * @returns pins installed by mise
 */
export function misePins(manifests: Manifest[], isPackagePinned: boolean): (InstallerPin & { version: string })[] {
    const tools = collectPins(manifests);
    const pins = tools.flatMap((tool) => {
        const installation = privateToolInstallation(tool, 'mise');
        if (installation?.kind === 'python' || (isPackagePinned && installation?.kind === 'npm')) return [];
        const pin = misePin(tool);
        return pin?.version === undefined ? [] : [{ name: pin.name, version: pin.version }];
    });
    if (tools.some((tool) => tool.provider !== 'host' && tool.installers['pypi']?.version !== undefined))
        pins.push(UV_INSTALLER);
    return pins;
}

/**
 * Mise pins and tasks, with npm dependencies kept in the isolated tool project.
 * @param manifests the selected manifests
 * @param version the gspot version
 * @param isPackagePinned whether npm tools are pinned in .gspot/package.json instead
 * @param tasks
 * @returns the generated file
 */
export function miseTasks(
    manifests: Manifest[],
    version: string,
    isPackagePinned: boolean,
    tasks: RunnerTask[] = RUNNER_TASKS,
): GeneratedFile {
    const lines = [
        headerFor(MISE_CONFIG_PATH, version).trimEnd(),
        '',
        `min_version = "${MISE_MIN_VERSION}"`,
        '',
        '[tools]',
        `"github:stefanionescu/gspot" = "${version}"`,
    ];
    for (const pin of misePins(manifests, isPackagePinned)) lines.push(`${tomlKey(pin.name)} = "${pin.version}"`);
    for (const task of tasks)
        lines.push(
            '',
            `[tasks.${JSON.stringify(task.name)}]`,
            `description = ${JSON.stringify(task.description)}`,
            `run = ${JSON.stringify(task.run)}`,
        );
    return { path: MISE_CONFIG_PATH, content: `${lines.join('\n')}\n`, readOnly: true, kind: 'runner' };
}

/**
 * Tools the repository's own mise.toml pins that gspot also pins.
 * @param root the repository root
 * @param manifests the selected manifests
 * @returns each tool pinned twice, with the file that pins it
 */
export function pinnedTwice(root: string, manifests: Manifest[]): { tool: string; version: string; place: string }[] {
    const files = openConfinedRoot(root);
    let current;
    try {
        current = files.read('mise.toml');
    } finally {
        files.close();
    }
    if (current === undefined) return [];
    const config = z
        .object({ tools: z.record(z.string(), z.unknown()).optional() })
        .parse(parseToml(current.bytes.toString('utf8')));
    const keys = new Set(Object.keys(config.tools ?? {}));
    const found: { tool: string; version: string; place: string }[] = [];
    for (const tool of collectPins(manifests)) {
        const pin = misePin(tool);
        if (pin?.version === undefined) continue;
        const bare = pin.name.slice(pin.name.indexOf(':') + 1);
        if (keys.has(pin.name) || keys.has(bare))
            found.push({ tool: tool.name, version: pin.version, place: 'mise.toml' });
    }
    return found;
}

export { MISE_CONFIG_PATH, MISE_MIN_VERSION };
