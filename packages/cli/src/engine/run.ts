import pLimit from 'p-limit';
import { join, relative } from 'node:path';
import { getTool } from '#cli/tools/pins.ts';
import { availableParallelism } from 'node:os';
import { remember } from '#cli/system/cache.ts';
import type { Session } from '#cli/types/tools.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { openSession } from '#cli/engine/session.ts';
import { runProcess } from '#cli/system/processes.ts';
import { buildRunReport } from '#cli/engine/report.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { findMissingEnvironment } from '#cli/tools/uv.ts';
import { subtractBaseline } from '#cli/engine/baseline.ts';
import { isActive, planChecks } from '#cli/engine/plan.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { CheckStop, GspotError } from '#cli/system/errors.ts';
import { holdCopyFolder } from '#cli/engine/copies/folders.ts';
import { formatUnexpectedError } from '#cli/system/terminal.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { runFixers, listConflictedPaths } from '#cli/engine/fixes.ts';
import type { RunSelection, PlannedCheck } from '#cli/types/engine/plan.ts';
import { findToolPath, findMissingDependencies } from '#cli/tools/inspect.ts';
import { buildBaseResult, runBuiltInCheck, normalizeResultPaths } from '#cli/engine/results.ts';

import type {
    Run,
    CheckCode,
    RunResult,
    RunOptions,
    CheckResult,
    CheckSession,
    PlanAfterFixes,
    CheckGeneration,
    CheckRunOptions,
} from '#cli/types/engine/run.ts';
import {
    FIX_FLAG,
    HOOK_FLAG,
    BASE_FLAG,
    DOCKER_TOOL,
    STAGED_FLAG,
    CHECK_COMMAND,
    FAILED_STATUSES,
    SHORT_HASH_LENGTH,
    DOCKER_DAEMON_NOTE,
    CANCELED_CHECK_NOTE,
    DOCKER_MISSING_MESSAGE,
} from '#cli/config/engine.ts';

const DOCKER_AVAILABILITY = Symbol('docker availability');

async function findMissingDocker(
    session: CheckSession,
    planned: PlannedCheck,
): Promise<Pick<CheckResult, 'status' | 'note'> | undefined> {
    if (planned.check.needs?.includes('docker') !== true) return undefined;
    const docker = await findToolPath(session, getTool(readConfigurations().values(), DOCKER_TOOL), session.root);
    if ('status' in docker) return { status: 'missing', note: DOCKER_MISSING_MESSAGE };
    const result = await remember(session.cache, DOCKER_AVAILABILITY, session.root, () =>
        runProcess([docker.path, 'info'], {
            cwd: session.root,
            timeoutSeconds: session.settings.tool_timeout_seconds,
            cancelSignal: session.cancelSignal,
        }),
    );
    return result.code === 0 ? undefined : { status: 'missing', note: DOCKER_DAEMON_NOTE };
}

async function findUnrunnableResult(
    session: CheckSession,
    planned: PlannedCheck,
    base: CheckResult,
): Promise<CheckResult | undefined> {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: CANCELED_CHECK_NOTE };
    const missing =
        findMissingEnvironment(session, planned) ??
        findMissingDependencies(session, planned) ??
        (await findMissingDocker(session, planned));
    return missing === undefined ? undefined : { ...base, ...missing };
}

function classifyCheckError(
    name: string,
    error: unknown,
    isVerbose: boolean,
): Pick<CheckResult, 'status' | 'note' | 'cause' | 'stack'> {
    if (error instanceof CheckStop)
        return { status: error.status, ...(error.status === 'skipped' && { cause: 'condition' }), note: error.message };
    if (error instanceof GspotError) return { status: 'error', note: error.message };
    return {
        status: 'error',
        note: formatUnexpectedError(name),
        ...(isVerbose && { stack: error instanceof Error ? (error.stack ?? error.message) : String(error) }),
    };
}

async function runPlannedCheck(run: Run, planned: PlannedCheck): Promise<CheckResult> {
    const { session } = run;
    const base = buildBaseResult(planned, session);
    const unrunnable = await findUnrunnableResult(session, planned, base);
    if (unrunnable) return unrunnable;
    const started = performance.now();
    try {
        return await runCheckCode(session, planned, run.codes.get(planned), {
            verbose: run.options.verbose,
            baselineRun: run.baselineRun,
        });
    } catch (error) {
        return {
            ...base,
            duration: Math.round(performance.now() - started),
            ...(session.cancelSignal?.aborted === true
                ? { status: 'error', note: CANCELED_CHECK_NOTE }
                : classifyCheckError(planned.check.id, error, run.options.verbose === true)),
        };
    }
}

function removeAcceptedFindings(run: Run, result: CheckResult): CheckResult {
    const { ignore } = run.session.settings;
    const kept = result.findings.filter((finding) =>
        ignore.every((record) => {
            const isOtherFinding = (['check', 'rule'] as const).some(
                (key) => record[key] !== undefined && record[key] !== finding[key],
            );
            return isOtherFinding || (record.paths !== undefined && !buildPathMatcher(record.paths)(finding.file));
        }),
    );
    const { findings } = subtractBaseline({ ...result, findings: kept }, run);
    if (result.status !== 'passed' && result.status !== 'failed') return { ...result, findings };
    return { ...result, findings, status: findings.length > 0 ? 'failed' : 'passed' };
}

function removeOutsideFindings(result: CheckResult, run: Run): CheckResult {
    const { options, session } = run;
    if (options.paths === undefined) return result;
    const paths = new Set(options.paths);
    const tracked = new Set(session.repository.files.map((file) => file.path));
    return {
        ...result,
        findings: result.findings.filter((finding) => paths.has(finding.file) || !tracked.has(finding.file)),
    };
}

function listSelectionArguments(selection: RunSelection): string[] {
    const base = selection.content === 'commit' ? selection.base?.slice(0, SHORT_HASH_LENGTH) : selection.base;
    const words = base === undefined ? [] : [BASE_FLAG, quoteArgument(base)];
    if (selection.messageFile !== undefined)
        words.push(HOOK_FLAG, 'commit-msg', '--', quoteArgument(selection.messageFile));
    if (selection.content === 'index') words.push(STAGED_FLAG);
    return words;
}

function formatReproduceCommand(checkId: string, scopeArgument: string | undefined, options: RunOptions): string {
    const { pathArguments: paths, selection = { content: 'working-tree' } } = options;
    const isScopeTarget = scopeArgument !== undefined && selection.messageFile === undefined && paths.length === 0;
    const targets = isScopeTarget ? [scopeArgument] : paths;
    const words = [
        CHECK_COMMAND,
        ...targets.map((path) => quoteArgument(path.startsWith('-') ? `./${path}` : path)),
        '--only',
        quoteArgument(checkId),
        ...listSelectionArguments(selection),
    ];
    return words.join(' ');
}

function findFixCommand(run: Run, result: CheckResult): Pick<CheckResult, 'fixCommand'> {
    const fixable = [...new Set(result.findings.filter((finding) => finding.fixable).map(({ file }) => file))];
    const conflicted = new Set(listConflictedPaths(run.session.root, fixable));
    const files = fixable.filter((file) => !conflicted.has(file));
    if (run.options.fix || files.length === 0) return {};
    const paths = files.map((file) => {
        const path = convertToPosixPath(relative(run.options.cwd, join(run.session.toolsRoot, file)));
        return quoteArgument(path.startsWith('-') ? `./${path}` : path);
    });
    return { fixCommand: [CHECK_COMMAND, FIX_FLAG, '--only', quoteArgument(result.check), ...paths].join(' ') };
}

function finishResult(run: Run, ran: CheckResult): CheckResult {
    const result = normalizeResultPaths(run.session, removeAcceptedFindings(run, removeOutsideFindings(ran, run)));
    if (!FAILED_STATUSES.has(result.status) || run.session.cancelSignal?.aborted === true) return result;
    const scopeArgument =
        result.scope === ''
            ? undefined
            : convertToPosixPath(relative(run.options.cwd, join(run.session.toolsRoot, result.scope))) || '.';
    return {
        ...result,
        ...findFixCommand(run, result),
        rerun: formatReproduceCommand(result.check, scopeArgument, run.options),
    };
}

async function runActiveChecks(run: Run, checks: PlannedCheck[]): Promise<CheckResult[]> {
    const settled = await Promise.allSettled(
        checks.map(async (planned) => {
            const result = finishResult(run, await runPlannedCheck(run, planned));
            if (result.status === 'passed' || result.status === 'failed') run.baselineRun.finished.push(planned);
            run.options.onProgress?.({
                check: result.check,
                scope: result.scope,
                duration: result.duration,
                finished: ++run.progress.finished,
                total: run.progress.total,
                comparison: run.comparison,
            });
            return result;
        }),
    );
    return settled.map((result) => {
        if (result.status === 'rejected') throw result.reason;
        return result.value;
    });
}

async function planAfterFixes(session: CheckSession, options: RunOptions): Promise<PlanAfterFixes> {
    const planned = planChecks(session, options);
    if (!options.fix) return { session, planned, fixes: undefined };
    const fixes = await runFixers(session, planned);
    const fixed = buildCheckSession(
        await openSession(session.root, {
            toolsRoot: session.toolsRoot,
            toolCache: session.toolCache,
            resources: session.resources,
            cancelSignal: session.cancelSignal,
        }),
        session.generation,
        session.selection,
    );
    return { session: fixed, planned: planChecks(fixed, options), fixes };
}

/**
Plan and run the checks, after the fixers when --fix asks, then drop ignored and baselined findings and build the run
report.

@param session the repository and its tools.
@param options the stage, the file selection, and the fix flags.
@returns the report, the plan, and the fix report when --fix ran.
*/
export async function runChecks(session: Session, options: RunOptions): Promise<RunResult> {
    using _copies = holdCopyFolder(session.root);
    const started = options.started ?? new Date();
    const { selection } = options;
    const comparison =
        selection?.reference === undefined || selection.content === 'message'
            ? undefined
            : { content: selection.content, reference: selection.reference };
    const {
        session: checked,
        planned,
        fixes,
    } = await planAfterFixes(buildCheckSession(session, options.generation, selection), options);
    const active = planned.filter((check) => isActive(check, selection) && check.skip === undefined);
    const codes = new Map(active.map((check) => [check, options.selectCheckCode(check.check)]));
    const last = active.filter((check) => codes.get(check)?.runsLast === true);
    const first = active.filter((check) => !last.includes(check));
    const run: Run = {
        session: checked,
        options,
        comparison,
        codes,
        baselineRun: {
            unused: Map.groupBy(structuredClone(options.baseline ?? []), ({ file }) => file),
            finished: [],
            paths: options.paths,
        },
        baselined: {},
        progress: { finished: 0, total: active.length },
    };
    const results = [...(await runActiveChecks(run, first)), ...(await runActiveChecks(run, last))];
    const report = buildRunReport({
        session: checked,
        options,
        comparison,
        started,
        planned,
        active: [...first, ...last],
        results,
        fixes,
        baselined: run.baselined,
    });
    return fixes ? { report, planned, fixes } : { report, planned };
}

/**
Give a session the generators of its checks, the content that the run selected, and the one limiter that every tool
process of its checks waits for.

@param session the repository and its tools.
@param generation the generators called by checks when they need their output.
@param selection the content of the run; without one, checks compare with `HEAD` and read the pushed commits.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: A check run, the session after fixers, and the tests build a check session through it, each with its own process limiter.
export function buildCheckSession(
    session: Session,
    generation: CheckGeneration,
    selection?: RunSelection,
): CheckSession {
    return { ...session, generation, selection, limitProcess: pLimit(availableParallelism()) };
}

/**
Run a built-in check or the command of its implementation.

@param session the repository and its tools.
@param planned the check to run.
@param code the check implementation, or undefined for a tool command.
@param options the command override and the verbosity of the notes.
*/
export async function runCheckCode(
    session: CheckSession,
    planned: PlannedCheck,
    code: CheckCode | undefined,
    options: CheckRunOptions,
): Promise<CheckResult> {
    if (code?.check !== undefined) return runBuiltInCheck(code.check, session, planned, options);
    return (code?.run ?? runCommandCheck)(session, planned, options);
}
