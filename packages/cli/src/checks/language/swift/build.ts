import { join, posix, relative } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readText } from '#cli/system/files/reads.ts';
import { type Files } from '#cli/types/system/files.ts';
import { targetInScope } from '#cli/repository/scopes.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { toolFindings } from '#cli/execution/command/output.ts';
import { TOOL_FILE_DIRECTORY } from '#cli/config/system/locations.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { convertToPosixPath, normalizeOutputPath } from '#cli/system/paths.ts';
import { type SwiftBuildPlan, type SwiftBuildOutput } from '#cli/types/checks/language.ts';
import { buildPlan, prepareBuild, scopeBuildFolder } from '#cli/checks/language/swift/build-folder.ts';

import {
    RULE_SUFFIX,
    BUILD_LEVELS,
    MESSAGE_LINE,
    PERIPHERY_YML,
    RESPONSE_FILE,
    SWIFTLINT_YML,
    REPORTED_LEVELS,
    COMPILER_LOG_FLAG,
    PERIPHERY_COMMAND,
    MACOS_PRIVATE_PATH,
    SWIFTLINT_CONFIG_FILE,
    SWIFTLINT_CONFIG_FLAG,
    BUILD_SOURCE_DIRECTORY,
    MACOS_PRIVATE_REPLACEMENT,
    SWIFTLINT_ANALYZE_COMMAND,
} from '#cli/config/checks/language/swift.ts';

const BUILD_MEMO = { create: () => new Map<string, Promise<SwiftBuildOutput>>() };

function outputFindings(input: CheckInput, output: string, levels: Set<string>, defaultRule: string): Finding[] {
    const root = convertToPosixPath(withoutPrivatePrefix(input.root));
    return [...new Set(output.split('\n'))]
        .flatMap((line) => {
            const groups = MESSAGE_LINE.exec(line)?.groups;
            if (groups === undefined || !levels.has(groups['level'] ?? '')) return [];
            return [groups];
        })
        .map((groups): Finding => {
            // SwiftLint appends the rule ID in parentheses; compiler diagnostics do not.
            const text = groups['text'] ?? '';
            const suffix = RULE_SUFFIX.exec(text)?.groups;
            const { rule = defaultRule, text: message = text } = suffix === undefined ? {} : suffix;
            const file = groups['file'] ?? '';
            const normalized = normalizeOutputPath(withoutPrivatePrefix(file));
            return findingAt(
                input,
                {
                    file: normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized,
                    line: Number(groups['line']),
                    column: Number(groups['column']),
                },
                rule,
                message,
            );
        });
}

// The package manager hands the compiler its sources in a response file, written as @path. The analyzer reads the
// file names from the log and opens no response file, so the log spells out each one.
function expandResponseFiles(line: string, folder: string, files: Files): string {
    if (!line.includes('swiftc ')) return line;
    return line.replaceAll(RESPONSE_FILE, (token, path: string) => {
        const content = files.read(
            convertToPosixPath(relative(withoutPrivatePrefix(folder), withoutPrivatePrefix(path))),
        );
        return content === undefined ? token : content.bytes.toString('utf8').trim().replaceAll('\n', ' ');
    });
}

async function runBuild(input: CheckInput, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const prepared = prepareBuild(input, plan.folder);
    using files = prepared.files;
    const { source } = prepared;
    if (plan.scratch !== undefined) files.removeTree(convertToPosixPath(relative(plan.folder, plan.scratch)));
    const cwd = join(source, input.selection.scope.path);
    const result = await runCheckTool(input, plan.argv, { cwd });
    // Match SwiftLint paths and expose response-file sources in the compiler log.
    const output = `${result.stdout}\n${result.stderr}`
        .split('\n')
        .map((line) => withoutPrivatePrefix(expandResponseFiles(line, plan.folder, files)))
        .join('\n');
    const log = convertToPosixPath(relative(plan.folder, plan.log));
    files.write(log, { bytes: Buffer.from(output), mode: PRIVATE_FILE }, files.read(log));
    return { output, code: result.code, source };
}

// Share the compiler log within a command; a later command must read the current source.
function buildOutput(input: CheckInput, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    return getCachedMapValue(input.reads, BUILD_MEMO, plan.folder, () => runBuild(input, plan));
}

// Normalize both macOS cache paths and compiler-log arguments with the same spelling.
function withoutPrivatePrefix(path: string): string {
    return path.replaceAll(MACOS_PRIVATE_PATH, MACOS_PRIVATE_REPLACEMENT);
}

/**
 * Builds the scope and reports the compiler errors.
 * @param input the check input.
 * @returns the findings.
 */
export async function swiftBuild(input: CheckInput): Promise<Finding[]> {
    const plan = buildPlan(input);
    const { output, code, source } = await buildOutput(input, plan);
    const originalPaths = output.replaceAll(withoutPrivatePrefix(source), input.root);
    const found = outputFindings(input, originalPaths, new Set(BUILD_LEVELS), 'compiler');
    return toolFindings({ code, stdout: originalPaths, stderr: '' }, found, 'Swift build');
}

/**
 * Runs the SwiftLint analyzer rules over the compiler log of the build.
 * @param input the check input.
 * @returns the findings.
 */
export async function swiftlintAnalyze(input: CheckInput): Promise<Finding[]> {
    const plan = buildPlan(input, 'analyze');
    const build = await buildOutput(input, plan);
    if (build.code !== 0) throw new Error(`Cannot analyze Swift because the build exited ${String(build.code)}.`);
    const config = join(input.root, TOOL_FILE_DIRECTORY, input.selection.scope.path, SWIFTLINT_YML);
    const argv = [...SWIFTLINT_ANALYZE_COMMAND, SWIFTLINT_CONFIG_FLAG, config, COMPILER_LOG_FLAG, plan.log];
    const { source } = build;
    const result = await runCheckTool(input, argv, { cwd: join(source, input.selection.scope.path) });
    const output = `${result.stdout}\n${result.stderr}`.replaceAll(source, input.root);
    const found = outputFindings(input, output, new Set(REPORTED_LEVELS), 'analyzer');
    return toolFindings(result, found, 'swiftlint');
}

/**
 * Runs Periphery over the project and reports every declaration nothing uses.
 * @param input the check input.
 * @returns the findings.
 */
export async function swiftPeriphery(input: CheckInput): Promise<Finding[]> {
    const folder = scopeBuildFolder(input, 'periphery');
    const config = join(input.root, TOOL_FILE_DIRECTORY, input.selection.scope.path, PERIPHERY_YML);
    const argv = [...PERIPHERY_COMMAND, config];
    const prepared = prepareBuild(input, folder);
    using files = prepared.files;
    const source = files.realPath(BUILD_SOURCE_DIRECTORY);
    const result = await runCheckTool(input, argv, { cwd: join(source, input.selection.scope.path) });
    const output = `${result.stdout}\n${result.stderr}`.replaceAll(source, input.root);
    const found = outputFindings(input, output, new Set(REPORTED_LEVELS), 'unused');
    return toolFindings(result, found, 'periphery');
}

/**
 * Retain SwiftLint's pointer for one scope, generated tool file and parent tool files in scratch copies.
 * @param input the selected check and repository files.
 * @returns the generated configuration paths for the selected Swift scope.
 */
export function swiftlintConfigurationFiles(input: CheckInput): string[] {
    const paths = [
        posix.join(input.selection.scope.path, SWIFTLINT_CONFIG_FILE),
        ...input.manifests
            .values()
            .flatMap((manifest) => manifest.toolFiles)
            .filter((config) => !config.fragment && config.pointer?.path === SWIFTLINT_CONFIG_FILE)
            .map((config) => targetInScope(input.selection.scope.path, config, input.generatedPaths())),
    ];
    for (const file of input.files) {
        for (
            let directory = posix.dirname(file.path);
            directory !== '.' && directory !== input.selection.scope.path;
            directory = posix.dirname(directory)
        ) {
            const path = posix.join(directory, SWIFTLINT_CONFIG_FILE);
            if (!paths.includes(path) && readText(input.root, path, input.reads) !== undefined) paths.push(path);
        }
    }
    return [...new Set(paths)].toSorted((a, b) => a.localeCompare(b));
}
