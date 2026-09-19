// The build of a Swift scope, the analyzer over its log, and Periphery over the project.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { swiftBuildPlan } from '#cli/apple/plan.ts';
import type { SwiftBuildPlan } from '#types/swift.ts';

const BUILD_TIMEOUT_MS = 3_600_000;
const DIAGNOSTIC = /^(?<file>\/[^:]+):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;
const built = new Map<string, Promise<string>>();

function relative(root: string, file: string): string {
    return file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
}

function diagnostics(input: EngineInput, output: string, levels: Set<string>, rule: string): Finding[] {
    const seen = new Set<string>();
    return output.split('\n').flatMap((line): Finding[] => {
        const groups = DIAGNOSTIC.exec(line)?.groups;
        if (groups === undefined || !levels.has(groups['level'] ?? '') || seen.has(line)) return [];
        seen.add(line);
        return [
            {
                check: input.spec.id,
                file: relative(input.root, groups['file'] ?? ''),
                line: Number(groups['line']),
                column: Number(groups['column']),
                rule,
                message: groups['text'] ?? '',
                fixable: false,
            },
        ];
    });
}

async function ranBuild(plan: SwiftBuildPlan): Promise<string> {
    const result = await run(plan.argv, { cwd: plan.cwd, timeoutMs: BUILD_TIMEOUT_MS });
    if (result.missing) throw new Error(`The ${plan.argv[0] ?? 'build'} command is not installed.`);
    mkdirSync(plan.folder, { recursive: true });
    const output = `${result.stdout}\n${result.stderr}`;
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
