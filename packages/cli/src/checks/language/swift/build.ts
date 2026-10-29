import { join, relative } from 'node:path';
import { type Files } from '#cli/types/system/files.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { type CheckFinding } from '#cli/types/runs/check.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { prepareBuild, planSwiftBuild } from '#cli/checks/language/swift/cache.ts';
import { type SwiftBuildPlan, type SwiftBuildOutput } from '#cli/types/checks/language/swift.ts';

import {
    SWIFTC_CALL,
    RULE_SUFFIX,
    BUILD_LEVELS,
    MESSAGE_LINE,
    COMPILER_RULE,
    RESPONSE_FILE,
    REPORTED_LEVELS,
    SWIFT_BUILD_NAME,
    MACOS_PRIVATE_PATH,
} from '#cli/config/checks/language/swift/build.ts';

const SWIFT_BUILD_OUTPUTS = { create: () => new Map<string, Promise<SwiftBuildOutput>>() };

/**
Turn the compiler lines of the reported levels into findings, with paths from the repository root.

@param session the repository and its tools.
@param output the compiler output.
@param options the levels to report, and the rule of a line without one.
@param options.levels the message levels to report.
@param options.defaultRule the rule of a line without a rule suffix.
@returns one finding for each compiler line of those levels.
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
            const suffix = RULE_SUFFIX.exec(text)?.groups;
            const { rule = defaultRule, text: message = text } = suffix === undefined ? {} : suffix;
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
@returns the compiler output, its exit code, and the source copy that it built.
*/
export async function runSwiftBuild(
    session: CheckSession,
    planned: PlannedCheck,
    plan: SwiftBuildPlan,
): Promise<SwiftBuildOutput> {
    return getCachedMapValue(session.reads, SWIFT_BUILD_OUTPUTS, plan.folder, async () => {
        const setup = prepareBuild(session.root, planned.files, plan.folder);
        using files = setup.files;
        const { source } = setup;
        if (plan.kind === 'package' && plan.purpose === 'analyze')
            files.deleteTree(convertToPosixPath(relative(plan.folder, plan.scratch)));
        const cwd = join(source, planned.scope.path);
        const result = await runCheckTool(session, planned, plan.commandArguments, { cwd });
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
        files.write(log, { bytes: Buffer.from(output), mode: PRIVATE_FILE }, files.read(log));
        return { output, code: result.code, source };
    });
}

/**
Builds the scope and reports the compiler errors.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkSwiftBuild(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const plan = planSwiftBuild(session, planned);
    const { output, code, source } = await runSwiftBuild(session, planned, plan);
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
