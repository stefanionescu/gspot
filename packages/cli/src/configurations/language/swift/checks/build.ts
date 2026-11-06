import { join, relative } from 'node:path';

import {
    BUILD_LEVELS,
    COMPILER_RULE,
    MACOS_PRIVATE_PATH,
    MESSAGE_LINE,
    REPORTED_LEVELS,
    RESPONSE_FILE,
    RULE_SUFFIX,
    SWIFT_BUILD_NAME,
    SWIFTC_CALL,
    XCODE_CLEAN_ACTION,
} from '#cli/config/configurations/builds.ts';
import { PRIVATE_FILE } from '#cli/config/system.ts';
import { acquireBuildLock, planSwiftBuild, prepareBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import { assertToolFindings } from '#cli/engine/tool-runs/output.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import { remember } from '#cli/system/cache.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { SwiftBuildOutput, SwiftBuildPlan } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckSession } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Files } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

const SWIFT_BUILD_OUTPUTS = Symbol('swift build outputs');

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

async function checkSwiftBuild(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
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

export const SWIFT_BUILD_CHECKS: Readonly<Record<string, CheckCode>> = {
    'swift/build': { check: checkSwiftBuild },
};
