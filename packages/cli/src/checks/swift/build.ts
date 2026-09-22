// The build of a Swift scope, the analyzer over its log, and Periphery over the project.
import { join } from 'node:path';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import type { Finding } from '#cli/output/finding.ts';
import type { EngineInput, Session } from '#cli/run/types.ts';
import { swiftBuildPlan } from '#cli/checks/swift/plan.ts';
import type { SwiftBuildPlan, SwiftBuildOutput } from '#cli/structure/swift/types.ts';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const DIAGNOSTIC = /^(?<file>\/[^:]+):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;
const RESPONSE_FILE = /@(?<path>\/\S+)/gu;
const PRIVATE_PREFIX = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;
const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;
const builds = new WeakMap<Session, Map<string, Promise<SwiftBuildOutput>>>();

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
function sourcesWritten(line: string): string {
    if (!line.includes('swiftc ')) return line;
    return line.replaceAll(RESPONSE_FILE, (token, path: string) =>
        existsSync(path) ? readFileSync(path, 'utf8').trim().replaceAll('\n', ' ') : token,
    );
}

// macOS keeps /tmp and /var under /private, and SwiftLint names a file without that prefix.
// The analyzer pairs a file with its compiler call by name, so the log names files the way SwiftLint does.
function expanded(log: string): string {
    return log
        .split('\n')
        .map((line) => sourcesWritten(line).replaceAll(PRIVATE_PREFIX, '$<before>/$<folder>/'))
        .join('\n');
}

async function ranBuild(input: EngineInput, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    if (input.session.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    if (plan.scratch !== undefined) rmSync(plan.scratch, { recursive: true, force: true });
    const result = await runCheckCommand(input, plan.argv, { cwd: plan.cwd });
    mkdirSync(plan.folder, { recursive: true });
    const output = expanded(`${result.stdout}\n${result.stderr}`);
    writeFileSync(plan.log, output);
    return { output, code: result.code };
}

// Share the compiler log within a command; a later command must observe the current source.
function buildOutput(input: EngineInput, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    const { session } = input;
    const scopes = builds.get(session) ?? new Map<string, Promise<SwiftBuildOutput>>();
    builds.set(session, scopes);
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
    const { output, code } = await buildOutput(input, swiftBuildPlan(input));
    const found = diagnostics(input, output, new Set(['error']), 'compiler');
    if (code === 0 || found.length > 0) return found;
    const detail = output.trim().split('\n').at(-1) ?? '';
    const text = detail === '' ? `The Swift build exited ${String(code)} without diagnostics.` : detail;
    return [{ check: input.spec.name, file: '', line: 1, rule: 'build', message: text, fixable: false }];
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
    const config = join(input.root, '.gspot', input.scope, 'swiftlint.yml');
    const argv = ['swiftlint', 'analyze', '--strict', '--quiet', '--config', config, '--compiler-log-path', plan.log];
    const result = await runCheckCommand(input, argv, { cwd: plan.cwd });
    const found = diagnostics(input, `${result.stdout}\n${result.stderr}`, new Set(['error', 'warning']), 'analyzer');
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
    const plan = swiftBuildPlan(input);
    const config = join(input.root, '.gspot', input.scope, 'periphery.yml');
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
    const result = await runCheckCommand(input, argv, { cwd: plan.cwd });
    const found = diagnostics(input, `${result.stdout}\n${result.stderr}`, new Set(['error', 'warning']), 'unused');
    if (found.length === 0 && result.code !== 0)
        throw new Error(`Periphery failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    return found;
}
