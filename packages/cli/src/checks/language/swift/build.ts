import { compareText } from '#cli/system/text.ts';
import { join, posix, relative } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { type Files } from '#cli/types/system/files.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { getConfigFilePath } from '#cli/runs/command/placeholders.ts';
import { getConfigFiles } from '#cli/generation/config-files/generate.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/selection.ts';
import { convertToPosixPath, listEnclosingFolders } from '#cli/system/paths.ts';
import { BUILD_SOURCE_FOLDER } from '#cli/config/checks/language/swift/cache.ts';
import { type SwiftBuildPlan, type SwiftBuildOutput } from '#cli/types/checks/language/swift.ts';
import { prepareBuild, planSwiftBuild, getScopeBuildFolder } from '#cli/checks/language/swift/cache.ts';

import {
    RULE_SUFFIX,
    BUILD_LEVELS,
    MESSAGE_LINE,
    RESPONSE_FILE,
    REPORTED_LEVELS,
    PERIPHERY_COMMAND,
    COMPILER_LOG_FLAG,
    MACOS_PRIVATE_PATH,
    SWIFTLINT_CONFIG_FILE,
    PERIPHERY_CONFIG_FILE,
    SWIFTLINT_CONFIG_FLAG,
    SWIFTLINT_CONFIG_NAME,
    SWIFTLINT_ANALYZE_COMMAND,
} from '#cli/config/checks/language/swift/build.ts';

const SWIFT_BUILD_OUTPUTS = { create: () => new Map<string, Promise<SwiftBuildOutput>>() };

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function removePrivatePrefix(text: string): string {
    return text.replaceAll(MACOS_PRIVATE_PATH, (_match, before: string, folder: string) => `${before}/${folder}/`);
}

function parseOutputFindings(
    session: Session,
    planned: PlannedCheck,
    output: string,
    { levels, defaultRule }: { levels: ReadonlySet<string>; defaultRule: string },
): Finding[] {
    const root = convertToPosixPath(removePrivatePrefix(session.root));
    return [...new Set(output.split('\n'))]
        .flatMap((line) => {
            const groups = MESSAGE_LINE.exec(line)?.groups;
            return groups === undefined || !levels.has(groups['level'] ?? '') ? [] : [groups];
        })
        .map((groups): Finding => {
            const text = groups['text'] ?? '';
            const suffix = RULE_SUFFIX.exec(text)?.groups;
            const { rule = defaultRule, text: message = text } = suffix === undefined ? {} : suffix;
            const file = groups['file'] ?? '';
            const posixFile = convertToPosixPath(file);
            return buildFinding(
                planned,
                {
                    file: posixFile.startsWith(`${root}/`) ? posixFile.slice(root.length + 1) : posixFile,
                    line: Number(groups['line']),
                    column: Number(groups['column']),
                },
                rule,
                message,
            );
        });
}

function expandResponseFiles(line: string, folder: string, files: Files): string {
    if (!line.includes('swiftc ')) return line;
    return line.replaceAll(RESPONSE_FILE, (token, path: string) => {
        const base = removePrivatePrefix(folder);
        const source = removePrivatePrefix(path);
        const content = files.read(convertToPosixPath(relative(base, source)));
        return content === undefined ? token : content.bytes.toString('utf8').trim().replaceAll('\n', ' ');
    });
}

async function runSwiftBuild(session: Session, planned: PlannedCheck, plan: SwiftBuildPlan): Promise<SwiftBuildOutput> {
    return getCachedMapValue(session.reads, SWIFT_BUILD_OUTPUTS, plan.folder, async () => {
        const setup = prepareBuild(session.root, planned.files, plan.folder);
        using files = setup.files;
        const { source } = setup;
        if (plan.kind === 'package' && plan.purpose === 'analyze')
            files.deleteTree(convertToPosixPath(relative(plan.folder, plan.scratch)));
        const cwd = join(source, planned.scope.folder.path);
        const result = await runCheckTool(session, planned, plan.commandArguments, { cwd });
        const output = `${result.stdout}\n${result.stderr}`
            .split('\n')
            .map((line) => removePrivatePrefix(expandResponseFiles(line, plan.folder, files)))
            .join('\n');
        const log = convertToPosixPath(relative(plan.folder, plan.log));
        files.write(log, { bytes: Buffer.from(output), mode: PRIVATE_FILE }, files.read(log));
        return { output, code: result.code, source };
    });
}

/**
Builds the scope and reports the compiler errors.

@param session the repository and its tools.
@param planned the scope to build.
@returns the findings.
*/
export async function checkSwiftBuild(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const plan = planSwiftBuild(session, planned);
    const { output, code, source } = await runSwiftBuild(session, planned, plan);
    const restored = output.replaceAll(removePrivatePrefix(source), () => removePrivatePrefix(session.root));
    const found = parseOutputFindings(session, planned, restored, {
        levels: BUILD_LEVELS,
        defaultRule: 'compiler',
    });
    return assertToolFindings({ code, stdout: restored, stderr: '' }, found, 'Swift build');
}

async function runCopiedTool(
    session: Session,
    planned: PlannedCheck,
    run: { source: string; commandArguments: string[]; defaultRule: string; tool: string },
): Promise<Finding[]> {
    const result = await runCheckTool(session, planned, run.commandArguments, {
        cwd: join(run.source, planned.scope.folder.path),
    });
    const output = removePrivatePrefix(`${result.stdout}\n${result.stderr}`).replaceAll(
        removePrivatePrefix(run.source),
        () => removePrivatePrefix(session.root),
    );
    const found = parseOutputFindings(session, planned, output, {
        levels: REPORTED_LEVELS,
        defaultRule: run.defaultRule,
    });
    return assertToolFindings(result, found, run.tool);
}

/**
Runs the SwiftLint analyzer rules over the compiler log of the build.

@param session the repository and its tools.
@param planned the scope to analyze.
@returns the findings.
*/
export async function checkSwiftSwiftlintAnalyze(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const plan = planSwiftBuild(session, planned, 'analyze');
    const build = await runSwiftBuild(session, planned, plan);
    if (build.code !== 0) throw new Error(`Cannot analyze Swift because the build exited ${String(build.code)}.`);
    const configFile = join(session.root, getConfigFilePath(session, planned, SWIFTLINT_CONFIG_NAME));
    const commandArguments = [
        ...SWIFTLINT_ANALYZE_COMMAND,
        SWIFTLINT_CONFIG_FLAG,
        configFile,
        COMPILER_LOG_FLAG,
        plan.log,
    ];
    return runCopiedTool(session, planned, {
        source: build.source,
        commandArguments,
        defaultRule: 'analyzer',
        tool: 'swiftlint',
    });
}

/**
Runs Periphery over the project and reports every declaration nothing uses.

@param session the repository and its tools.
@param planned the scope to scan.
@returns the findings.
*/
export async function checkSwiftPeriphery(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const folder = getScopeBuildFolder(session.installedRoot, planned.scope.folder.path, 'periphery');
    const configFile = join(session.root, getConfigFilePath(session, planned, PERIPHERY_CONFIG_FILE));
    const commandArguments = [...PERIPHERY_COMMAND, configFile];
    const setup = prepareBuild(session.root, planned.files, folder);
    using files = setup.files;
    return await runCopiedTool(session, planned, {
        source: files.readCanonicalPath(BUILD_SOURCE_FOLDER),
        commandArguments,
        defaultRule: 'unused',
        tool: 'periphery',
    });
}

/**
Lists the SwiftLint files a copy keeps: the scope pointer, the config file, and SwiftLint files in parent folders.

@param session the repository and its tools.
@param planned the scope files and config files.
@returns the repository-relative paths, sorted.
*/
export function listSwiftlintConfigFiles(session: Session, planned: PlannedCheck): string[] {
    const paths = [
        joinScope(planned.scope.folder.path, SWIFTLINT_CONFIG_FILE),
        ...session.configurations
            .values()
            .flatMap((configuration) => configuration.configFiles)
            .filter((configFile) => configFile.pointer?.path === SWIFTLINT_CONFIG_FILE)
            .map((configFile) => getConfigFileTarget(planned.scope.folder.path, configFile, getConfigFiles(session))),
    ];
    for (const file of planned.files) {
        const folders = listEnclosingFolders(posix.dirname(file.path));
        const parents = folders.slice(0, folders.indexOf(planned.scope.folder.path));
        for (const folder of parents) {
            const path = posix.join(folder, SWIFTLINT_CONFIG_FILE);
            if (findCachedText(session.reads, path) !== undefined) paths.push(path);
        }
    }
    return [...new Set(paths)].toSorted((a, b) => compareText(a, b));
}
