// Prepare and run tool commands and collect their findings.
import { join, relative } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import { checkInput } from '#cli/checks/run/built-in.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { buildBaseResult } from '#cli/checks/run/report.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { RAN_STATUSES } from '#cli/config/checks/run/run.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { checkCompanions } from '#cli/planning/needed-tools.ts';
import type { ExecutionFailure } from '#cli/types/tools/run.ts';
import { stripCoverageArguments } from '#cli/planning/checks.ts';
import { copyIntoScratch } from '#cli/checks/run/copy/scratch.ts';
import { FILES_PLACEHOLDER } from '#cli/config/configurations.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { buildInvocations } from '#cli/checks/run/command/batches.ts';
import type { Finding, CheckResult, CheckRunOptions } from '#cli/types/checks/run/check.ts';
import { findTool, runPlannedTool, buildCompanionEnvironment } from '#cli/checks/run/command/tool.ts';
import { buildCheckResult, recordInvocation, parseCommandFindings } from '#cli/checks/run/command/output.ts';

import {
    expandCommand,
    listScratchFiles,
    replacePlaceholders,
    buildFileInvocations,
    listCommandToolFiles,
} from '#cli/checks/run/command/placeholders.ts';
import type {
    CommandRun,
    CommandGroup,
    CommandInputs,
    Substitutions,
    PreparedScratch,
    CommandRunState,
    PreparedCommand,
    SubstitutionCheck,
    CommandEnvironment,
} from '#cli/types/checks/run/command.ts';

async function runCommands(
    planned: PlannedCheck,
    {
        session,
        tool,
        prepared,
        base,
    }: { session: Session; tool: ToolDeclaration; prepared: PreparedCommand; base: CheckResult },
): Promise<CheckResult> {
    const { check } = planned;
    const { cwd, commandArguments } = prepared;
    const state: CommandRunState = { root: prepared.root, cwd, findings: [], isFailed: false };
    const started = performance.now();
    for (const invocation of prepared.commands) {
        const { result, failure } = await runPlannedTool(
            invocation.commandArguments,
            {
                ...prepared,
                cancelSignal: session.cancelSignal,
            },
            planned.scope.view,
            tool.name,
        );
        if (failure !== undefined)
            return { ...base, ...failure, duration: performance.now() - started, command: commandArguments };
        const parsed = parseCommandFindings(planned, result, { cwd, root: state.root });
        if (parsed.findings === undefined)
            return {
                ...base,
                status: 'error',
                duration: performance.now() - started,
                note: parsed.note,
                command: commandArguments,
            };
        recordInvocation(planned, tool, { invocation, result, findings: parsed.findings }, state);
    }
    return buildCheckResult(check, { base, state, commandArguments, started });
}

// Report a missing tool file before a nested check runs.
function findMissingToolFile(
    planned: PlannedCheck,
    {
        session,
        command,
        base,
        options,
    }: { session: Session; command: string[]; base: CheckResult; options: CheckRunOptions },
): CheckResult | undefined {
    const paths = options.toolFiles?.(checkInput(session, planned));
    if (paths === undefined) return undefined;
    using files = openFiles(session.root);
    const missing = [...paths, ...listCommandToolFiles(session, planned, command)].find((path) =>
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
            ? await prepareInScratch(planned, { session, command, toolPath, options })
            : undefined;
    using copy = created?.copy;
    let root = scratchCopyFolder;
    let scratchSession = session;
    let prepared: PreparedCommand;
    if (created === undefined) {
        let selectedEnvironment = environment;
        if (root !== undefined) {
            scratchSession = { ...session, root };
            selectedEnvironment = buildCommandEnvironment(scratchSession, planned, options);
        }
        prepared = prepareCommand(planned, {
            session: scratchSession,
            command,
            environment: selectedEnvironment,
            toolPath,
        });
    } else {
        root = (copy as PreparedScratch['copy']).path;
        scratchSession = created.session;
        prepared = created.prepared;
    }
    prepared.env = buildCompanionEnvironment(
        session,
        checkCompanions(planned.scope, planned.check, command),
        prepared.env,
    );
    const result = await runCommands(planned, { session: scratchSession, tool, prepared, base });
    if (root === undefined) return result;
    const reported = expandCommand(session, planned, command, environment.substitutions);
    reported[0] = toolPath;
    return { ...result, command: reported.filter((part) => typeof part === 'string') };
}

// Resolve declared companion tools before this command runs.
function findUnavailableCompanion(
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
 * @param planned the selected check declaration.
 * @param commandRun the execution values.
 * @param commandRun.session the repository session.
 * @param commandRun.command the executable and authored arguments.
 * @param commandRun.toolPath the resolved executable path.
 * @param commandRun.options the command and scratch-copy options.
 * @returns the disposable copy and prepared command.
 */
export async function prepareInScratch(
    planned: PlannedCheck,
    commandRun: { session: Session; command: string[]; toolPath: string; options: CheckRunOptions },
): Promise<PreparedScratch> {
    const { session, command, toolPath, options } = commandRun;
    const copy = await copyIntoScratch({
        root: session.root,
        paths: [
            ...listScratchFiles(session, planned, command),
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
            prepared: prepareCommand(planned, {
                session: scratchSession,
                command,
                environment: buildCommandEnvironment(scratchSession, planned, options),
                toolPath,
            }),
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
 * @param options the command and scratch-copy options of this invocation.
 *
 * @returns paths and environment shared by tool inspection and execution.
 */
export function buildCommandEnvironment(
    session: Session,
    planned: PlannedCheck,
    options: CheckRunOptions,
): CommandEnvironment {
    const { check, scope } = planned;
    const runsInScope = check.cwd === 'scope' || (check.runs === 'scope' && check.cwd !== 'root');
    const cwd = runsInScope ? join(session.root, scope.scope.path) : session.root;
    const substitutions = buildCommandSubstitutions(session, planned, cwd);
    const files = substitutions.files;
    if (options.arguments !== undefined) substitutions.files = options.arguments(checkInput(session, planned));
    const env = Object.fromEntries(
        Object.entries({ ...planned.tool?.env, ...planned.check.env }).map(([name, value]) => [
            name,
            replacePlaceholders(session, planned, value, substitutions),
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
export function buildCommandSubstitutions(
    source: CommandInputs,
    planned: SubstitutionCheck,
    cwd: string,
): Substitutions {
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
 * @param planned the selected check declaration.
 * @param commandRun the execution values.
 * @param commandRun.session the repository session.
 * @param commandRun.command the executable and authored arguments.
 * @param commandRun.environment the working paths and tool environment.
 * @param commandRun.toolPath the resolved executable path.
 * @returns the working directory and bounded commands.
 */
export function prepareCommand(
    planned: PlannedCheck,
    commandRun: { session: Session; command: string[]; environment: CommandEnvironment; toolPath: string },
): PreparedCommand {
    const { session, command, environment, toolPath } = commandRun;
    const { root, cwd, files, substitutions, env } = environment;
    const commandArguments = expandCommand(session, planned, command, substitutions);
    commandArguments[0] = toolPath;
    const commands = command.includes(FILES_PLACEHOLDER)
        ? buildInvocations(planned, { session, command, substitutions, toolPath })
        : buildFileInvocations(commandArguments, files);
    return { root, cwd, commandArguments: commandArguments.filter((part) => typeof part === 'string'), commands, env };
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
    const command = stripCoverageArguments(planned, options) as string[];
    const tool = planned.tool as ToolDeclaration;
    const base = buildBaseResult(planned, session);
    const environment = buildCommandEnvironment(session, planned, options);
    const { env, cwd } = environment;
    const missing = findMissingToolFile(planned, { session, command, base, options });
    if (missing !== undefined) return missing;
    const availability = findTool(session, cwd, tool, env);
    if ('status' in availability) return { ...base, ...availability };
    const companion = findUnavailableCompanion(session, planned, command, cwd);
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
 * @param groups source files and command arguments for each invocation.
 *
 * @returns the combined findings and the failing invocation when one stops the check.
 */
export async function runCommandGroups(
    session: Session,
    planned: PlannedCheck,
    groups: CommandGroup[],
): Promise<CheckResult> {
    const findings: Finding[] = [];
    const report = { ...buildBaseResult(planned, session), findings };
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
