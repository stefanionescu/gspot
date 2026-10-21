import { join, posix, relative } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { type Files } from '#cli/types/system/files.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { getToolFiles } from '#cli/generation/settings/generate.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { selectToolFilePath } from '#cli/runs/command/placeholders.ts';
import { joinScope, buildScopeTarget } from '#cli/repository/scopes.ts';
import { convertToPosixPath, listEnclosingFolders } from '#cli/system/paths.ts';
import { type SwiftBuildPlan, type SwiftBuildOutput } from '#cli/types/checks/swift.ts';
import { buildPlan, prepareBuild, getScopeBuildFolder } from '#cli/checks/swift/cache.ts';

import {
    RULE_SUFFIX,
    BUILD_LEVELS,
    MESSAGE_LINE,
    RESPONSE_FILE,
    REPORTED_LEVELS,
    COMPILER_LOG_FLAG,
    PERIPHERY_COMMAND,
    MACOS_PRIVATE_PATH,
    PERIPHERY_TOOL_FILE,
    SWIFTLINT_TOOL_FILE,
    BUILD_SOURCE_FOLDER,
    SWIFTLINT_CONFIG_FILE,
    SWIFTLINT_CONFIG_FLAG,
    MACOS_PRIVATE_REPLACEMENT,
    SWIFTLINT_ANALYZE_COMMAND,
} from '#cli/config/checks/swift.ts';

const SWIFT_BUILD_MEMO = { create: () => new Map<string, Promise<SwiftBuildOutput>>() };

function parseOutputFindings(
    session: Session,
    planned: PlannedCheck,
    output: string,
    { levels, defaultRule }: { levels: ReadonlySet<string>; defaultRule: string },
): Finding[] {
    const root = convertToPosixPath(stripMacosPrivatePrefix(session.root));
    return [...new Set(output.split('\n'))]
        .flatMap((line) => {
            const groups = MESSAGE_LINE.exec(line)?.groups;
            if (groups === undefined || !levels.has(groups['level'] ?? '')) return [];
            return [groups];
        })
        .map((groups): Finding => {
            // SwiftLint appends the rule ID in parentheses; compiler messages do not.
            const text = groups['text'] ?? '';
            const suffix = RULE_SUFFIX.exec(text)?.groups;
            const { rule = defaultRule, text: message = text } = suffix === undefined ? {} : suffix;
            const file = groups['file'] ?? '';
            const normalized = convertToPosixPath(stripMacosPrivatePrefix(file));
            return buildFinding(
                planned,
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

// The build tool hands the compiler its sources in a response file, written as @path. The analyzer reads the
// file names from the log and opens no response file, so the log spells out each one.
function expandResponseFiles(line: string, folder: string, files: Files): string {
    if (!line.includes('swiftc ')) return line;
    return line.replaceAll(RESPONSE_FILE, (token, path: string) => {
        const content = files.read(
            convertToPosixPath(relative(stripMacosPrivatePrefix(folder), stripMacosPrivatePrefix(path))),
        );
        return content === undefined ? token : content.bytes.toString('utf8').trim().replaceAll('\n', ' ');
    });
}

async function runSwiftBuild(
    session: Session,
    planned: PlannedCheck,
    plan: SwiftBuildPlan,
    purpose: 'compile' | 'analyze',
): Promise<SwiftBuildOutput> {
    return getCachedMapValue(session.reads, SWIFT_BUILD_MEMO, plan.folder, async () => {
        const prepared = prepareBuild(session.root, planned.files, plan.folder);
        using files = prepared.files;
        const { source } = prepared;
        if (plan.kind === 'package' && purpose === 'analyze')
            files.deleteTree(convertToPosixPath(relative(plan.folder, plan.scratch)));
        const cwd = join(source, planned.selection.scope.path);
        const result = await runCheckTool(session, planned, plan.commandArguments, { cwd });
        // Match SwiftLint paths and expose response-file sources in the compiler log.
        const output = `${result.stdout}\n${result.stderr}`
            .split('\n')
            .map((line) => stripMacosPrivatePrefix(expandResponseFiles(line, plan.folder, files)))
            .join('\n');
        const log = convertToPosixPath(relative(plan.folder, plan.log));
        files.write(log, { bytes: Buffer.from(output), mode: PRIVATE_FILE }, files.read(log));
        return { output, code: result.code, source };
    });
}

// Normalize both macOS cache paths and compiler-log arguments with the same spelling.
function stripMacosPrivatePrefix(path: string): string {
    return path.replaceAll(MACOS_PRIVATE_PATH, MACOS_PRIVATE_REPLACEMENT);
}

/**
 * Builds the scope and reports the compiler errors.
 *
 * @param session the repository and its tools.
 * @param planned the scope to build.
 * @returns the findings.
 */
export async function checkSwiftBuild(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const plan = buildPlan(session, planned);
    const { output, code, source } = await runSwiftBuild(session, planned, plan, 'compile');
    const originalPaths = output.replaceAll(stripMacosPrivatePrefix(source), session.root);
    const found = parseOutputFindings(session, planned, originalPaths, {
        levels: BUILD_LEVELS,
        defaultRule: 'compiler',
    });
    return assertToolFindings({ code, stdout: originalPaths, stderr: '' }, found, 'Swift build');
}

/**
 * Runs the SwiftLint analyzer rules over the compiler log of the build.
 *
 * @param session the repository and its tools.
 * @param planned the scope to analyze.
 * @returns the findings.
 */
export async function checkSwiftlintAnalyze(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const plan = buildPlan(session, planned, { purpose: 'analyze' });
    const build = await runSwiftBuild(session, planned, plan, 'analyze');
    if (build.code !== 0) throw new Error(`Cannot analyze Swift because the build exited ${String(build.code)}.`);
    const toolFile = join(session.root, selectToolFilePath(session, planned, SWIFTLINT_TOOL_FILE));
    const commandArguments = [
        ...SWIFTLINT_ANALYZE_COMMAND,
        SWIFTLINT_CONFIG_FLAG,
        toolFile,
        COMPILER_LOG_FLAG,
        plan.log,
    ];
    const { source } = build;
    const result = await runCheckTool(session, planned, commandArguments, {
        cwd: join(source, planned.selection.scope.path),
    });
    const output = `${result.stdout}\n${result.stderr}`.replaceAll(source, session.root);
    const found = parseOutputFindings(session, planned, output, { levels: REPORTED_LEVELS, defaultRule: 'analyzer' });
    return assertToolFindings(result, found, 'swiftlint');
}

/**
 * Runs Periphery over the project and reports every declaration nothing uses.
 *
 * @param session the repository and its tools.
 * @param planned the scope to scan.
 * @returns the findings.
 */
export async function checkSwiftPeriphery(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const folder = getScopeBuildFolder(session.installedRoot, planned.selection.scope.path, 'periphery');
    const toolFile = join(session.root, selectToolFilePath(session, planned, PERIPHERY_TOOL_FILE));
    const commandArguments = [...PERIPHERY_COMMAND, toolFile];
    const prepared = prepareBuild(session.root, planned.files, folder);
    using files = prepared.files;
    const source = files.readRealPath(BUILD_SOURCE_FOLDER);
    const result = await runCheckTool(session, planned, commandArguments, {
        cwd: join(source, planned.selection.scope.path),
    });
    const output = `${result.stdout}\n${result.stderr}`.replaceAll(source, session.root);
    const found = parseOutputFindings(session, planned, output, { levels: REPORTED_LEVELS, defaultRule: 'unused' });
    return assertToolFindings(result, found, 'periphery');
}

/**
 * Lists the SwiftLint files a scratch copy keeps: the scope pointer, the tool file, and SwiftLint files in parent folders.
 *
 * @param session the repository and its tools.
 * @param planned the scope files and tool files.
 * @returns the repository-relative paths, sorted.
 */
export function listSwiftlintToolFiles(session: Session, planned: PlannedCheck): string[] {
    const paths = [
        joinScope(planned.selection.scope.path, SWIFTLINT_CONFIG_FILE),
        ...session.manifests
            .values()
            .flatMap((manifest) => manifest.toolFiles)
            .filter((toolFile) => toolFile.pointer?.path === SWIFTLINT_CONFIG_FILE)
            .map((toolFile) => buildScopeTarget(planned.selection.scope.path, toolFile, getToolFiles(session).targets)),
    ];
    for (const file of planned.files) {
        const folders = listEnclosingFolders(posix.dirname(file.path));
        for (const folder of folders.slice(0, folders.indexOf(planned.selection.scope.path))) {
            const path = posix.join(folder, SWIFTLINT_CONFIG_FILE);
            if (findCachedText(session.reads, path) !== undefined) paths.push(path);
        }
    }
    return [...new Set(paths)].toSorted((a, b) => a.localeCompare(b));
}
