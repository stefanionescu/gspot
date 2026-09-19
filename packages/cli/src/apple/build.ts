// The build of a Swift scope, the analyzer over its log, and Periphery over the project.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { swiftBuildPlan } from '#cli/apple/plan.ts';
import type { SwiftBuildPlan } from '#types/swift.ts';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const BUILD_TIMEOUT_MS = 3_600_000;
const DIAGNOSTIC = /^(?<file>\/[^:]+):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;
const RESPONSE_FILE = /@(?<path>\/\S+)/gu;
const PRIVATE_PREFIX = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;
const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;
const built = new Map<string, Promise<string>>();

// macOS reaches /tmp and /var through /private, and one tool names a file with the prefix while another leaves it out.
function bare(path: string): string {
    return path.replace(/^\/private\/(?=tmp\/|var\/)/u, '/');
}

function relative(root: string, file: string): string {
    const [from, to] = [bare(root), bare(file)];
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
                check: input.spec.id,
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

async function ranBuild(plan: SwiftBuildPlan): Promise<string> {
    if (plan.scratch !== undefined) rmSync(plan.scratch, { recursive: true, force: true });
    const result = await run(plan.argv, { cwd: plan.cwd, timeoutMs: BUILD_TIMEOUT_MS });
    if (result.missing) throw new Error(`The ${plan.argv[0] ?? 'build'} command is not installed.`);
    mkdirSync(plan.folder, { recursive: true });
    const output = expanded(`${result.stdout}\n${result.stderr}`);
    writeFileSync(plan.log, output);
    return output;
}

// One build for each scope in a process: the analyzer reads the log the build check wrote.
function buildOutput(plan: SwiftBuildPlan): Promise<string> {
    const running = built.get(plan.cwd) ?? ranBuild(plan);
    built.set(plan.cwd, running);
    return running;
}

/**
 * Builds the scope and reports the compiler errors.
 * @param input the engine input
 * @returns the findings
 */
export async function swiftBuild(input: EngineInput): Promise<Finding[]> {
    const output = await buildOutput(swiftBuildPlan(input));
    const found = diagnostics(input, output, new Set(['error']), 'compiler');
    if (found.length > 0 || !/BUILD FAILED|error: /u.test(output)) return found;
    const [last = 'The build failed.'] = output
        .split('\n')
        .filter((line) => line.includes('error'))
        .slice(-1);
    return [{ check: input.spec.id, file: '', line: 1, rule: 'build', message: last.trim(), fixable: false }];
}

/**
 * Runs the SwiftLint analyzer rules over the compiler log of the build.
 * @param input the engine input
 * @returns the findings
 */
export async function swiftAnalyze(input: EngineInput): Promise<Finding[]> {
    const plan = swiftBuildPlan(input);
    await buildOutput(plan);
    const config = join(input.root, '.gspot', input.scope, 'swiftlint.yml');
    const argv = ['swiftlint', 'analyze', '--strict', '--quiet', '--config', config, '--compiler-log-path', plan.log];
    const result = await run(argv, { cwd: plan.cwd, timeoutMs: BUILD_TIMEOUT_MS });
    if (result.missing) throw new Error('SwiftLint is not installed.');
    return diagnostics(input, `${result.stdout}\n${result.stderr}`, new Set(['error', 'warning']), 'analyzer');
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
    const result = await run(argv, { cwd: plan.cwd, timeoutMs: BUILD_TIMEOUT_MS });
    if (result.missing) throw new Error('Periphery is not installed.');
    const found = diagnostics(input, `${result.stdout}\n${result.stderr}`, new Set(['error', 'warning']), 'unused');
    if (found.length === 0 && result.code !== 0)
        throw new Error(`Periphery failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    return found;
}
