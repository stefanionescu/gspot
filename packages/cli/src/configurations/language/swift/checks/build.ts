import { join, relative } from 'node:path';
import { remember } from '#cli/system/cache.ts';
import type { Files } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';
import { PRIVATE_FILE } from '#cli/config/system.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { assertToolFindings } from '#cli/engine/tool-runs/output.ts';
import type { SwiftBuildPlan, SwiftBuildOutput } from '#cli/types/configurations/language.ts';
import { prepareBuild, planSwiftBuild, acquireBuildLock } from '#cli/configurations/language/swift/checks/cache.ts';

import {
    SWIFTC_CALL,
    RULE_SUFFIX,
    BUILD_LEVELS,
    MESSAGE_LINE,
    COMPILER_RULE,
    RESPONSE_FILE,
    REPORTED_LEVELS,
    SWIFT_BUILD_NAME,
    XCODE_CLEAN_ACTION,
    MACOS_PRIVATE_PATH,
} from '#cli/config/configurations/builds.ts';

const SWIFT_BUILD_OUTPUTS = Symbol('swift build outputs');

/**
Turn the compiler lines of the reported levels into findings, with paths from the repository root.

@param session the repository and its tools.
@param output the compiler output.
@param options the levels to report, and the rule of a line without one.
@param options.levels the message levels to report.
@param options.defaultRule the rule of a line without a rule suffix.
*/
function parseOutputFindings(
    session: Session,

    output: string,
    { levels, defaultRule }: { levels: ReadonlySet<string>; defaultRule: string },
): CheckFinding[] {
    const root = convertToPosixPath(
        session.root.replaceAll(MACOS_PRIVATE_PATH, (_match, before: string, folder: string) => `${before}/${folder}/`),
    );
    return [...new Set(output.split('\n'))]
        .flatMap((line) => {
            const groups = MESSAGE_LINE.exec(line)?.groups;
            return groups === undefined || !levels.has(groups['level'] ?? '') ? [] : [groups];
        })
        .map((groups): CheckFinding => {
            const text = groups['text'] ?? '';
            const { rule = defaultRule, text: message = text } = RULE_SUFFIX.exec(text)?.groups ?? {
                rule: defaultRule,
                text,
            };
            const file = groups['file'] ?? '';
            const posixFile = convertToPosixPath(file);
            return {
                file: posixFile.startsWith(`${root}/`) ? posixFile.slice(root.length + 1) : posixFile,
                line: Number(groups['line']),
                column: Number(groups['column']),
                rule: rule,
                message: message,
            };
        });
}

function expandResponseFiles(line: string, folder: string, files: Files): string {
    if (!line.includes(SWIFTC_CALL)) return line;
    return line.replaceAll(RESPONSE_FILE, (token, path: string) => {
        const base = folder.replaceAll(
            MACOS_PRIVATE_PATH,
            (_match, before: string, folder: string) => `${before}/${folder}/`,
        );
        const source = path.replaceAll(
            MACOS_PRIVATE_PATH,
            (_match, before: string, folder: string) => `${before}/${folder}/`,
        );
        const content = files.read(convertToPosixPath(relative(base, source)));
        return content === undefined ? token : content.bytes.toString('utf8').trim().replaceAll('\n', ' ');
    });
}

/**
Build the scope once for each build folder, and keep the compiler output for the other Swift checks.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
@param plan the build folder, the command, and the log path.
@param options how to run the build.
@param options.clean whether to compile every file, so the compiler log lists each one.
*/
export async function runSwiftBuild(
    session: CheckSession,
    planned: PlannedCheck,
    plan: SwiftBuildPlan,
    { clean }: { clean: boolean },
): Promise<SwiftBuildOutput> {
    const key = JSON.stringify([plan.folder, clean]);
    return remember(session.cache, SWIFT_BUILD_OUTPUTS, key, async (): Promise<SwiftBuildOutput> => {
        using _lock = await acquireBuildLock(plan.folder, session.cancelSignal);
        const { files, source } = prepareBuild(session.root, planned.files, plan.folder);
        if (clean && plan.kind === 'package') files.deleteTree(convertToPosixPath(relative(plan.folder, plan.scratch)));
        const [program, ...commandArguments] = plan.commandArguments as [string, ...string[]];
        const isCleanXcode = clean && plan.kind === 'xcode';
        const cwd = join(source, planned.scope.path);
        const result = await runCheckTool(
            session,
            planned,
            [program, ...(isCleanXcode ? [XCODE_CLEAN_ACTION] : []), ...commandArguments],
            { cwd },
        );
        const output = `${result.stdout}\n${result.stderr}`
            .split('\n')
            .map((line) =>
                expandResponseFiles(line, plan.folder, files).replaceAll(
                    MACOS_PRIVATE_PATH,
                    (_match, before: string, folder: string) => `${before}/${folder}/`,
                ),
            )
            .join('\n');
        const log = convertToPosixPath(relative(plan.folder, plan.log));
        files.write(log, { bytes: Buffer.from(output), mode: PRIVATE_FILE });
        return { output, code: result.code, source, files };
    });
}

/**
Builds the scope and reports the compiler errors.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkSwiftBuild(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const plan = planSwiftBuild(session, planned);
    const { output, code, source } = await runSwiftBuild(session, planned, plan, { clean: false });
    const restored = output.replaceAll(
        source.replaceAll(MACOS_PRIVATE_PATH, (_match, before: string, folder: string) => `${before}/${folder}/`),
        () =>
            session.root.replaceAll(
                MACOS_PRIVATE_PATH,
                (_match, before: string, folder: string) => `${before}/${folder}/`,
            ),
    );
    const found = parseOutputFindings(session, restored, {
        levels: BUILD_LEVELS,
        defaultRule: COMPILER_RULE,
    });
    return assertToolFindings({ code, stdout: restored, stderr: '' }, found, SWIFT_BUILD_NAME);
}

/**
Run a Swift tool in the source copy of the build, and read its compiler lines as findings.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
@param run what to run, and how to read its output.
@param run.source the source copy of the build.
@param run.commandArguments the tool command and its arguments.
@param run.defaultRule the rule of a line without a rule suffix.
@param run.tool the tool name that the error of a failed run names.
@returns the findings, with paths from the repository root.
*/
export async function runCopiedTool(
    session: CheckSession,
    planned: PlannedCheck,
    run: { source: string; commandArguments: string[]; defaultRule: string; tool: string },
): Promise<CheckFinding[]> {
    const result = await runCheckTool(session, planned, run.commandArguments, {
        cwd: join(run.source, planned.scope.path),
    });
    const output = `${result.stdout}\n${result.stderr}`
        .replaceAll(MACOS_PRIVATE_PATH, (_match, before: string, folder: string) => `${before}/${folder}/`)
        .replaceAll(
            run.source.replaceAll(
                MACOS_PRIVATE_PATH,
                (_match, before: string, folder: string) => `${before}/${folder}/`,
            ),
            () =>
                session.root.replaceAll(
                    MACOS_PRIVATE_PATH,
                    (_match, before: string, folder: string) => `${before}/${folder}/`,
                ),
        );
    const found = parseOutputFindings(session, output, {
        levels: REPORTED_LEVELS,
        defaultRule: run.defaultRule,
    });
    return assertToolFindings(result, found, run.tool);
}
