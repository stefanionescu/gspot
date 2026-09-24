import { rmSync } from 'node:fs';
import type { Finding } from '#cli/output/schema.ts';
import type { EngineInput } from '#cli/run/engines.ts';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
// The build of a Swift scope, the analyzer over its log, and Periphery over the project.
import { join, relative as relativePath } from 'node:path';
import { swiftBuildPlan } from '#cli/checks/swift/plan.ts';
import type { ConfinedRoot } from '#cli/platform/filesystem.ts';
import type { SwiftBuildPlan } from '#cli/checks/swift/plan.ts';
import { openBuildCache, prepareBuildSources } from '#cli/platform/build-cache.ts';

/** The observed build status and its compiler output. */
type SwiftBuildOutput = { code: number; output: string };

const DIAGNOSTIC = /^(?<file>\/[^:]+):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;
const RESPONSE_FILE = /@(?<path>\/\S+)/gu;
const PRIVATE_PREFIX = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;
const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;
const builds = new WeakMap<object, Map<string, Promise<SwiftBuildOutput>>>();

function relative(root: string, file: string): string {
    const [from, to] = [
        root.replace(/^\/private\/(?=tmp\/|var\/)/u, '/'),
        file.replace(/^\/private\/(?=tmp\/|var\/)/u, '/'),
    ];
    return to.startsWith(`${from}/`) ? to.slice(from.length + 1) : file;
}

// SwiftLint closes a line with the id of its rule in brackets; the compiler names no rule.
function ruleOf(text: string, named: string): { rule: string; text: string } {
    const groups = RULE_SUFFIX.exec(text)?.groups;
    return groups === undefined
        ? { rule: named, text }
        : { rule: groups['rule'] ?? named, text: groups['text'] ?? text };
}

function diagnostics(input: EngineInput, output: string, levels: Set<string>, named: string): Finding[] {
    const seen = new Set<string>();
    return output.split('\n').flatMap((line): Finding[] => {
        const groups = DIAGNOSTIC.exec(line)?.groups;
        if (groups === undefined || !levels.has(groups['level'] ?? '') || seen.has(line)) return [];
        seen.add(line);
        const { rule, text } = ruleOf(groups['text'] ?? '', named);
        return [
            {
                check: input.spec.name,
                file: relative(input.root, groups['file'] ?? ''),
                line: Number(groups['line']),
                column: Number(groups['column']),
                rule,
                message: text,
                fixable: false,
            },
        ];
    });
}

// The package manager hands the compiler its sources in a response file, written as @path. The analyzer reads the
// file names from the log and opens no response file, so each one is written out in the log.
function sourcesWritten(line: string, folder: string, files: ConfinedRoot): string {
    if (!line.includes('swiftc ')) return line;
    return line.replaceAll(RESPONSE_FILE, (token, path: string) => {
        const content = files.read(relativePath(folder, path).replaceAll('\\', '/'));
        return content === undefined ? token : content.bytes.toString('utf8').trim().replaceAll('\n', ' ');
    });
}

// macOS keeps /tmp and /var under /private, and SwiftLint names a file without that prefix.
// The analyzer pairs a file with its compiler call by name, so the log names files the way SwiftLint does.
function expanded(log: string, folder: string, files: ConfinedRoot): string {
    return log
        .split('\n')
        .map((line) => sourcesWritten(line, folder, files).replaceAll(PRIVATE_PREFIX, '$<before>/$<folder>/'))
        .join('\n');
}

async function ranBuild(input: EngineInput, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const files = openBuildCache(plan.folder);
    try {
        if (plan.scratch !== undefined) {
            files.stat(relativePath(plan.folder, plan.scratch).replaceAll('\\', '/'));
            rmSync(plan.scratch, { recursive: true, force: true });
        }
        const source = prepareBuildSources(
            input.root,
            input.files.map((file) => file.path),
            plan.folder,
            files,
        );
        const cwd = join(source, input.scope);
        const result = await runCheckCommand(input, plan.argv, { cwd });
        const output = expanded(`${result.stdout}\n${result.stderr}`, plan.folder, files);
        const log = relativePath(plan.folder, plan.log).replaceAll('\\', '/');
        files.write(log, { bytes: Buffer.from(output), mode: 0o600 }, files.read(log));
        return { output, code: result.code };
    } finally {
        files.close();
    }
}

// Share the compiler log within a command; a later command must observe the current source.
function buildOutput(input: EngineInput, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    const { observations } = input;
    const scopes = builds.get(observations) ?? new Map<string, Promise<SwiftBuildOutput>>();
    builds.set(observations, scopes);
    const running = scopes.get(plan.folder) ?? ranBuild(input, plan);
    scopes.set(plan.folder, running);
    return running;
}

/**
 * Builds the scope and reports the compiler errors.
 * @param input the engine input
 * @returns the findings
 */
export async function swiftBuild(input: EngineInput): Promise<Finding[]> {
    const plan = swiftBuildPlan(input);
    const { output, code } = await buildOutput(input, plan);
    const originalPaths = output.replaceAll(join(plan.folder, 'source'), input.root);
    const found = diagnostics(input, originalPaths, new Set(['error']), 'compiler');
    if (code === 0 || found.length > 0) return found;
    const detail = output.trim();
    throw new Error(
        `The Swift build exited ${String(code)} without source diagnostics.${detail === '' ? '' : `\n${detail}`}`,
    );
}

/**
 * Runs the SwiftLint analyzer rules over the compiler log of the build.
 * @param input the engine input
 * @returns the findings
 */
export async function swiftAnalyze(input: EngineInput): Promise<Finding[]> {
    const plan = swiftBuildPlan(input, 'analyze');
    const build = await buildOutput(input, plan);
    if (build.code !== 0) throw new Error(`Cannot analyze Swift because the build exited ${String(build.code)}.`);
    const config = join(input.root, '.gspot', 'config', input.scope, 'swiftlint.yml');
    const argv = ['swiftlint', 'analyze', '--strict', '--quiet', '--config', config, '--compiler-log-path', plan.log];
    const source = join(plan.folder, 'source');
    const result = await runCheckCommand(input, argv, { cwd: join(source, input.scope) });
    const output = `${result.stdout}\n${result.stderr}`.replaceAll(source, input.root);
    const found = diagnostics(input, output, new Set(['error', 'warning']), 'analyzer');
    if (found.length === 0 && result.code !== 0)
        throw new Error(`The SwiftLint analyzer exited ${String(result.code)}: ${result.stderr.trim()}`);
    return found;
}

/**
 * Runs Periphery over the project and reports every declaration nothing uses.
 * @param input the engine input
 * @returns the findings
 */
export async function swiftPeriphery(input: EngineInput): Promise<Finding[]> {
    const plan = swiftBuildPlan(input, 'periphery');
    const config = join(input.root, '.gspot', 'config', input.scope, 'periphery.yml');
    const argv = [
        'periphery',
        'scan',
        '--config',
        config,
        '--strict',
        '--quiet',
        '--format',
        'xcode',
        '--disable-update-check',
    ];
    const files = openBuildCache(plan.folder);
    try {
        const source = prepareBuildSources(
            input.root,
            input.files.map((file) => file.path),
            plan.folder,
            files,
        );
        const result = await runCheckCommand(input, argv, { cwd: join(source, input.scope) });
        const output = `${result.stdout}\n${result.stderr}`.replaceAll(source, input.root);
        const found = diagnostics(input, output, new Set(['error', 'warning']), 'unused');
        if (found.length === 0 && result.code !== 0)
            throw new Error(`Periphery failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
        return found;
    } finally {
        files.close();
    }
}
