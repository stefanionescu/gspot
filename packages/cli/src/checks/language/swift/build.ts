import { rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { findingAt } from '#cli/execution/finding.ts';
import type { Root } from '#cli/types/platform/platform.ts';
import { PRIVATE_FILE } from '#cli/config/platform/root.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { GSPOT_FOLDER } from '#cli/config/repository/repository.ts';
import { swiftBuildPlan } from '#cli/checks/language/swift/plan.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import { openBuildCache, prepareBuildSources } from '#cli/checks/language/swift/cache.ts';
import type { SwiftBuildPlan, SwiftBuildOutput } from '#cli/types/checks/language/swift.ts';
import { DIAGNOSTIC, RULE_SUFFIX, RESPONSE_FILE, PRIVATE_PREFIX } from '#cli/config/checks/language/swift.ts';

const builds = new WeakMap<object, Map<string, Promise<SwiftBuildOutput>>>();

function diagnostics(input: EngineInput, output: string, levels: Set<string>, named: string): Finding[] {
    const root = input.root.replace(/^\/private\/(?=tmp\/|var\/)/u, '/');
    return [...new Set(output.split('\n'))]
        .flatMap((line) => {
            const groups = DIAGNOSTIC.exec(line)?.groups;
            if (groups === undefined || !levels.has(groups['level'] ?? '')) return [];
            return [groups];
        })
        .map((groups): Finding => {
            // SwiftLint appends the rule ID in brackets; compiler diagnostics do not.
            const text = groups['text'] ?? '';
            const suffix = RULE_SUFFIX.exec(text)?.groups ?? {};
            const file = groups['file'] ?? '';
            const normalized = file.replace(/^\/private\/(?=tmp\/|var\/)/u, '/');
            return findingAt(
                input,
                {
                    file: normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : file,
                    line: Number(groups['line']),
                    column: Number(groups['column']),
                },
                suffix['rule'] ?? named,
                suffix['text'] ?? text,
            );
        });
}

// The package manager hands the compiler its sources in a response file, written as @path. The analyzer reads the
// file names from the log and opens no response file, so each one is written out in the log.
function sourcesWritten(line: string, folder: string, files: Root): string {
    if (!line.includes('swiftc ')) return line;
    return line.replaceAll(RESPONSE_FILE, (token, path: string) => {
        const content = files.read(toPosix(relative(folder, path)));
        return content === undefined ? token : content.bytes.toString('utf8').trim().replaceAll('\n', ' ');
    });
}

async function ranBuild(input: EngineInput, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    using files = openBuildCache(plan.folder);
    if (plan.scratch !== undefined) {
        files.stat(toPosix(relative(plan.folder, plan.scratch)));
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
    // Match SwiftLint paths and expose response-file sources in the compiler log.
    const output = `${result.stdout}\n${result.stderr}`
        .split('\n')
        .map((line) => sourcesWritten(line, plan.folder, files).replaceAll(PRIVATE_PREFIX, '$<before>/$<folder>/'))
        .join('\n');
    const log = toPosix(relative(plan.folder, plan.log));
    files.write(log, { bytes: Buffer.from(output), mode: PRIVATE_FILE }, files.read(log));
    return { output, code: result.code };
}

// Share the compiler log within a command; a later command must read the current source.
function buildOutput(input: EngineInput, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    const { reads } = input;
    const scopes = builds.get(reads) ?? new Map<string, Promise<SwiftBuildOutput>>();
    builds.set(reads, scopes);
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
    const suffix = detail === '' ? '' : `\n${detail}`;
    throw new Error(`The Swift build exited ${String(code)} without source diagnostics.${suffix}`);
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
    const config = join(input.root, GSPOT_FOLDER, 'config', input.scope, 'swiftlint.yml');
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
    const config = join(input.root, GSPOT_FOLDER, 'config', input.scope, 'periphery.yml');
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
    using files = openBuildCache(plan.folder);
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
}
