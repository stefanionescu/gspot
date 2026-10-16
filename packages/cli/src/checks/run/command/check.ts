import { join, relative } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import { emptyResult } from '#cli/checks/run/report.ts';
import { checkInput } from '#cli/checks/run/built-in.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { RAN_STATUSES } from '#cli/config/execution/run.ts';
import { coverageArguments } from '#cli/planning/checks.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { checkCompanions } from '#cli/planning/needed-tools.ts';
import type { ExecutionFailure } from '#cli/types/tools/run.ts';
import { copyIntoScratch } from '#cli/checks/run/copy/scratch.ts';
import { FILES_PLACEHOLDER } from '#cli/config/configurations.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { batchedCommands } from '#cli/checks/run/command/batches.ts';
import type { Finding, CheckResult, CheckRunOptions } from '#cli/types/execution/check.ts';
import { findTool, runPlannedTool, companionEnvironment } from '#cli/checks/run/command/tool.ts';
import { finishResult, commandOutcome, recordInvocation } from '#cli/checks/run/command/output.ts';

import {
    substitute,
    scratchFiles,
    perFileCommands,
    substituteValue,
    commandToolFiles,
} from '#cli/checks/run/command/placeholders.ts';
import type {
    CommandRun,
    CommandGroup,
    CommandSource,
    Substitutions,
    PreparedScratch,
    CommandRunState,
    PreparedCommand,
    SubstitutionCheck,
    CommandEnvironment,
} from '#cli/types/execution/command.ts';

async function runCommands(
    session: Session,
    planned: PlannedCheck,
    tool: ToolDeclaration,
    prepared: PreparedCommand,
    base: CheckResult,
): Promise<CheckResult> {
    const { check } = planned;
    const { cwd, argv } = prepared;
    const state: CommandRunState = { root: prepared.root, cwd, findings: [], isFailed: false };
    const started = performance.now();
    for (const invocation of prepared.commands) {
        const { result, failure } = await runPlannedTool(
            invocation.argv,
            {
                ...prepared,
                cancelSignal: session.cancelSignal,
            },
            planned.scope.view,
            tool.name,
        );
        if (failure !== undefined) return { ...base, ...failure, duration: performance.now() - started, command: argv };
        const parsed = commandOutcome(planned, result, { cwd, root: state.root });
        if (parsed.findings === undefined)
            return {
                ...base,
                status: 'error',
                duration: performance.now() - started,
                note: parsed.note,
                command: argv,
            };
        recordInvocation(planned, tool, { invocation, result, findings: parsed.findings }, state);
    }
    return finishResult(base, check, state, argv, started);
}

// Report a missing tool file before a nested check runs.
function missingToolFile(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    base: CheckResult,
    options: CheckRunOptions,
): CheckResult | undefined {
    const paths = options.toolFiles?.(checkInput(session, planned));
    if (paths === undefined) return undefined;
    using files = openFiles(session.root);
    const missing = [...paths, ...commandToolFiles(session, planned, command)].find((path) =>
        isInGspotFolder(path) ? files.read(path) === undefined : readCachedText(session.reads, path) === undefined,
    );
    if (missing === undefined) return undefined;
    return {
        ...base,
        status: 'error',
        note: `The tool file ${missing} is missing. Run gspot apply.`,
    };
}

// Runs in the supplied scratch folder or a new scratch copy when the check requires one.
// Reports the original repository command.
async function runInScratch(run: CommandRun, scratchCopyFolder: string | undefined): Promise<CheckResult> {
    const { session, planned, tool, command, toolPath, environment, base, options } = run;
    const created =
        scratchCopyFolder === undefined && planned.check.run_in_copy === true
            ? await prepareInScratch(session, planned, command, toolPath, options)
            : undefined;
    using copy = created?.copy;
    let root = scratchCopyFolder;
    let scratchSession = session;
    let prepared: PreparedCommand;
    if (created === undefined) {
        let selectedEnvironment = environment;
        if (root !== undefined) {
            scratchSession = { ...session, root };
            selectedEnvironment = commandEnvironment(scratchSession, planned, options);
        }
        prepared = prepareCommand(scratchSession, planned, command, selectedEnvironment, toolPath);
    } else {
        root = (copy as PreparedScratch['copy']).path;
        scratchSession = created.session;
        prepared = created.prepared;
    }
    prepared.env = companionEnvironment(session, checkCompanions(planned.scope, planned.check, command), prepared.env);
    const result = await runCommands(scratchSession, planned, tool, prepared, base);
    if (root === undefined) return result;
    const reported = substitute(session, planned, command, environment.substitutions);
    reported[0] = toolPath;
    return { ...result, command: reported.filter((part) => typeof part === 'string') };
}

// Resolve declared companion tools before this command runs.
function unavailableCompanion(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    cwd: string,
): ExecutionFailure | undefined {
    for (const name of checkCompanions(planned.scope, planned.check, command)) {
        const required = getToolDeclaration(session.manifests.values(), name);
        const availability = findTool(session, cwd, required);
        if ('status' in availability) return availability;
    }
    return undefined;
}

/**
 * Copy selected inputs and prepare the command against that scratch copy.
 *
 * @param session the repository session.
 * @param planned the selected check and its files.
 * @param command the executable and argument list.
 * @param toolPath the resolved executable path.
 * @param options the command options.
 *
 * @returns the disposable copy, its session, and the prepared command.
 */
export async function prepareInScratch(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    toolPath: string,
    options: CheckRunOptions = {},
): Promise<PreparedScratch> {
    const copy = await copyIntoScratch({
        root: session.root,
        paths: [
            ...scratchFiles(session, planned, command),
            ...(options.toolFiles?.(checkInput(session, planned)) ?? []),
        ],
        dependencies: [],
        cancelSignal: session.cancelSignal,
    });
    try {
        const scratchSession = { ...session, root: copy.path };
        return {
            copy,
            session: scratchSession,
            prepared: prepareCommand(
                scratchSession,
                planned,
                command,
                commandEnvironment(scratchSession, planned, options),
                toolPath,
            ),
        };
    } catch (error) {
        copy[Symbol.dispose]();
        throw error;
    }
}

/**
 * Resolve the scope's working directory and expand tool environment values.
 *
 * @param session the repository or scratch session.
 * @param planned the selected check and files.
 * @param options the command options.
 *
 * @returns paths and environment shared by tool inspection and execution.
 */
export function commandEnvironment(
    session: Session,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): CommandEnvironment {
    const { check, scope } = planned;
    const runsInScope = check.cwd === 'scope' || (check.runs === 'scope' && check.cwd !== 'root');
    const cwd = runsInScope ? join(session.root, scope.scope.path) : session.root;
    const substitutions = commandSubstitutions(session, planned, cwd);
    const files = substitutions.files;
    if (options.arguments !== undefined) substitutions.files = options.arguments(checkInput(session, planned));
    const env = Object.fromEntries(
        Object.entries({ ...planned.tool?.env, ...planned.check.env }).map(([name, value]) => [
            name,
            substituteValue(session, planned, value, substitutions),
        ]),
    );
    return { root: session.root, cwd, files, substitutions, env };
}

/**
 * Derive command placeholders from the selected scope and actual working directory.
 *
 * @param source the command's repository and settings.
 * @param planned the selected check and source files.
 * @param cwd the directory from which the tool reads files.
 *
 * @returns effective settings and file paths relative to that directory.
 */
export function commandSubstitutions(source: CommandSource, planned: SubstitutionCheck, cwd: string): Substitutions {
    const substitutions: Substitutions = {
        files: planned.files.map((file) => convertToPosixPath(relative(cwd, join(source.root, file.path)))),
        scope: planned.scope.scope.path,
        root: source.root,
        indent: planned.scope.view.format.indent_style === 'space' ? planned.scope.view.format.indent_width : 0,
    };
    if (planned.messageFile !== undefined) substitutions.messageFile = planned.messageFile;
    return substitutions;
}

/**
 * Expand check and fix commands into bounded file batches.
 *
 * @param session the session rooted at the working copy.
 * @param planned the planned check.
 * @param command the command with placeholders.
 * @param environment resolved paths and tool environment.
 * @param toolPath the resolved executable.
 *
 * @returns the working directory and commands.
 */
export function prepareCommand(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    environment: CommandEnvironment,
    toolPath?: string,
): PreparedCommand {
    const { root, cwd, files, substitutions, env } = environment;
    const argv = substitute(session, planned, command, substitutions);
    if (toolPath !== undefined) argv[0] = toolPath;
    const commands = command.includes(FILES_PLACEHOLDER)
        ? batchedCommands(session, planned, command, substitutions, toolPath)
        : perFileCommands(argv, files);
    return { root, cwd, argv: argv.filter((part) => typeof part === 'string'), commands, env };
}

/**
 * Inspect the selected tool and execute a check's expanded commands.
 *
 * @param session the open repository session.
 * @param planned the check to run.
 * @param options optional command and scratch folder supplied by the check.
 *
 * @returns the check result with attributed findings.
 */
export async function runCheckCommand(
    session: Session,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    const command = coverageArguments(planned, options) as string[];
    const tool = planned.tool as ToolDeclaration;
    const base = emptyResult(planned);
    const environment = commandEnvironment(session, planned, options);
    const { env, cwd } = environment;
    const missing = missingToolFile(session, planned, command, base, options);
    if (missing !== undefined) return missing;
    const availability = findTool(session, cwd, tool, env);
    if ('status' in availability) return { ...base, ...availability };
    const companion = unavailableCompanion(session, planned, command, cwd);
    if (companion !== undefined) return { ...base, ...companion };
    return runInScratch(
        { session, planned, tool, command, toolPath: availability.path, environment, base, options },
        options.scratchRoot,
    );
}

/**
 * Merge command groups, retaining earlier findings when a later tool fails.
 *
 * @param session the repository and tools.
 * @param planned the planned check.
 * @param groups source files and argv for each invocation.
 *
 * @returns the combined findings and the failing invocation when one stops the check.
 */
export async function runCommandGroups(
    session: Session,
    planned: PlannedCheck,
    groups: CommandGroup[],
): Promise<CheckResult> {
    const findings: Finding[] = [];
    const report = { ...emptyResult(planned), findings };
    for (const { files, command } of groups) {
        const result = await runCheckCommand(session, { ...planned, files }, { command });
        report.duration += result.duration;
        findings.push(...result.findings);
        if (!RAN_STATUSES.has(result.status))
            return { ...result, fileCount: report.fileCount, duration: report.duration, findings: report.findings };
        if (result.status === 'failed') report.status = 'failed';
    }
    return report;
}
