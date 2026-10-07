import { join, relative } from 'node:path';
import { memo } from '#cli/platform/memo.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { findingAt } from '#cli/checks/finding.ts';
import type { Root } from '#cli/types/platform/root.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import { prepareBuild } from '#cli/checks/language/swift/cache.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';
import { CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';
import { buildPlan, scopeBuildFolder } from '#cli/checks/language/swift/plan.ts';
import type { SwiftBuildPlan, SwiftBuildOutput } from '#cli/types/checks/language/swift.ts';
import { DIAGNOSTIC, RULE_SUFFIX, RESPONSE_FILE, MACOS_PRIVATE_PATH } from '#cli/config/checks/language/swift.ts';

const BUILD_MEMO = { create: () => new Map<string, Promise<SwiftBuildOutput>>() };

function diagnostics(input: EngineInput, output: string, levels: Set<string>, defaultRule: string): Finding[] {
    const root = withoutPrivatePrefix(input.root);
    return [...new Set(output.split('\n'))]
        .flatMap((line) => {
            const groups = DIAGNOSTIC.exec(line)?.groups;
            if (groups === undefined || !levels.has(groups['level'] ?? '')) return [];
            return [groups];
        })
        .map((groups): Finding => {
            // SwiftLint appends the rule ID in parentheses; compiler diagnostics do not.
            const text = groups['text'] ?? '';
            const suffix = RULE_SUFFIX.exec(text)?.groups;
            const { rule = defaultRule, text: message = text } = suffix === undefined ? {} : suffix;
            const file = groups['file'] ?? '';
            const normalized = withoutPrivatePrefix(file);
            return findingAt(
                input,
                {
                    file: normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : file,
                    line: Number(groups['line']),
                    column: Number(groups['column']),
                },
                rule,
                message,
            );
        });
}

// The package manager hands the compiler its sources in a response file, written as @path. The analyzer reads the
// file names from the log and opens no response file, so each one is written out in the log.
function expandResponseFiles(line: string, folder: string, files: Root): string {
    if (!line.includes('swiftc ')) return line;
    return line.replaceAll(RESPONSE_FILE, (token, path: string) => {
        const content = files.read(toPosix(relative(folder, path)));
        return content === undefined ? token : content.bytes.toString('utf8').trim().replaceAll('\n', ' ');
    });
}

async function runBuild(input: EngineInput, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const prepared = prepareBuild(input, plan.folder);
    using files = prepared.files;
    const { source } = prepared;
    if (plan.scratch !== undefined) files.removeTree(toPosix(relative(plan.folder, plan.scratch)));
    const cwd = join(source, input.scope);
    const result = await runEngineTool(input, plan.argv, { cwd });
    // Match SwiftLint paths and expose response-file sources in the compiler log.
    const output = `${result.stdout}\n${result.stderr}`
        .split('\n')
        .map((line) => withoutPrivatePrefix(expandResponseFiles(line, plan.folder, files)))
        .join('\n');
    const log = toPosix(relative(plan.folder, plan.log));
    files.write(log, { bytes: Buffer.from(output), mode: PRIVATE_FILE }, files.read(log));
    return { output, code: result.code, source };
}

// Share the compiler log within a command; a later command must read the current source.
function buildOutput(input: EngineInput, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    const scopes = memo(input.reads, BUILD_MEMO);
    const running = scopes.get(plan.folder) ?? runBuild(input, plan);
    scopes.set(plan.folder, running);
    return running;
}

// Normalize both macOS cache paths and compiler-log arguments with the same spelling.
function withoutPrivatePrefix(path: string): string {
    return path.replaceAll(MACOS_PRIVATE_PATH, '$<before>/$<folder>/');
}

/**
 * Builds the scope and reports the compiler errors.
 * @param input the engine input
 * @returns the findings
 */
export async function swiftBuild(input: EngineInput): Promise<Finding[]> {
    const plan = buildPlan(input);
    const { output, code, source } = await buildOutput(input, plan);
    const originalPaths = output.replaceAll(withoutPrivatePrefix(source), input.root);
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
export async function swiftlintAnalyze(input: EngineInput): Promise<Finding[]> {
    const plan = buildPlan(input, 'analyze');
    const build = await buildOutput(input, plan);
    if (build.code !== 0) throw new Error(`Cannot analyze Swift because the build exited ${String(build.code)}.`);
    const config = join(input.root, CONFIGURATION_DIRECTORY, input.scope, 'swiftlint.yml');
    const argv = ['swiftlint', 'analyze', '--strict', '--quiet', '--config', config, '--compiler-log-path', plan.log];
    const { source } = build;
    const result = await runEngineTool(input, argv, { cwd: join(source, input.scope) });
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
    const folder = scopeBuildFolder(input, 'periphery');
    const config = join(input.root, CONFIGURATION_DIRECTORY, input.scope, 'periphery.yml');
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
    const prepared = prepareBuild(input, folder);
    try {
        const result = await runEngineTool(input, argv, { cwd: join(prepared.source, input.scope) });
        const output = `${result.stdout}\n${result.stderr}`.replaceAll(prepared.source, input.root);
        const found = diagnostics(input, output, new Set(['error', 'warning']), 'unused');
        if (found.length === 0 && result.code !== 0) throw new Error(toolOutputDetail(result, 'Periphery failed'));
        return found;
    } finally {
        prepared.files.close();
    }
}
