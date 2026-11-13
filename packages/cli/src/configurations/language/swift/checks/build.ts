import { existsSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

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
    WARNING_LEVELS,
    XCODE_CLEAN_ACTION,
    XCODE_WARNINGS_MARKER,
} from '#cli/config/configurations/swift.ts';
import { PRIVATE_FILE } from '#cli/config/system.ts';
import { acquireBuildLock, planSwiftBuild, prepareBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import { assertToolFindings } from '#cli/engine/run/tool-runs/failures.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { remember } from '#cli/system/cache.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { SwiftBuildOutput, SwiftBuildPlan } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';
import type { Files } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

const SWIFT_BUILD_OUTPUTS = Symbol('swift build outputs');

function restoreSourcePaths(output: string, source: string, root: string): string {
    return output.replaceAll(stripPrivatePrefix(source), () => stripPrivatePrefix(root));
}

function parseOutputFindings(
    session: Session,
    output: string,
    { levels, defaultRule }: { levels: ReadonlySet<string>; defaultRule: string },
): CheckFinding[] {
    const root = convertToPosixPath(stripPrivatePrefix(session.root));
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
                rule,
                message,
            };
        });
}

function expandResponseFiles(line: string, folder: string, files: Files): string {
    if (!line.includes(SWIFTC_CALL)) return line;
    return line.replaceAll(RESPONSE_FILE, (token, path: string) => {
        const base = stripPrivatePrefix(folder);
        const source = stripPrivatePrefix(path);
        const content = files.read(convertToPosixPath(relative(base, source)));
        return content === undefined ? token : content.bytes.toString('utf8').trim().replaceAll('\n', ' ');
    });
}

/**
Build the package or the Xcode scheme, and report the compiler errors. A package build passes `-warnings-as-errors`.
An Xcode build cannot: a build setting on the command line reaches the package dependencies too, which Xcode compiles
with `-suppress-warnings`, and the compiler refuses both options together. So an Xcode build reports each warning in a
repository file as a finding. An incremental build prints a warning only for a file that it compiles again, so a run
with warnings leaves a marker, and the next run builds from clean.
*/
async function checkSwiftBuild(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const plan = planSwiftBuild(session, planned);
    const hasWarningMarker = plan.kind === 'xcode' && existsSync(join(plan.folder, XCODE_WARNINGS_MARKER));
    const { output, code, source, files } = await runSwiftBuild(session, planned, plan, { clean: hasWarningMarker });
    const restored = restoreSourcePaths(output, source, session.root);
    const errors = parseOutputFindings(session, restored, { levels: BUILD_LEVELS, defaultRule: COMPILER_RULE });
    const warnings =
        plan.kind === 'xcode'
            ? parseOutputFindings(session, restored, { levels: WARNING_LEVELS, defaultRule: COMPILER_RULE }).filter(
                  ({ file }) => !isAbsolute(file),
              )
            : [];
    if (warnings.length > 0) files.write(XCODE_WARNINGS_MARKER, { bytes: Buffer.alloc(0), mode: PRIVATE_FILE });
    else if (hasWarningMarker) files.deleteFile(XCODE_WARNINGS_MARKER);
    return assertToolFindings({ code, stdout: restored, stderr: '' }, [...errors, ...warnings], SWIFT_BUILD_NAME);
}

export function stripPrivatePrefix(text: string): string {
    return text.replaceAll(MACOS_PRIVATE_PATH, (_match, before: string, folder: string) => `${before}/${folder}/`);
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
            .map((line) => stripPrivatePrefix(expandResponseFiles(line, plan.folder, files)))
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
    const output = restoreSourcePaths(
        stripPrivatePrefix(`${result.stdout}\n${result.stderr}`),
        run.source,
        session.root,
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
