import { availableParallelism } from 'node:os';
import { join, relative } from 'node:path';
import { setImmediate } from 'node:timers/promises';

import pLimit from 'p-limit';

import {
    CANCELED_CHECK_NOTE,
    DOCKER_DAEMON_NOTE,
    DOCKER_MISSING_MESSAGE,
    DOCKER_TOOL,
    FAILED_STATUSES,
    FIX_FLAG,
    GSPOT_CHECK_PREFIX,
    ONLY_FLAG,
    PROGRESS_INTERVAL_MILLISECONDS,
    RAN_STATUSES,
} from '#cli/config/engine.ts';
import { GSPOT_CHECK } from '#cli/config/manifests.ts';
import { holdCopyFolder } from '#cli/engine/copies/folders.ts';
import { listConflictedPaths, runFixers } from '#cli/engine/fixes.ts';
import { assertShippedCheck, isActive, planChecks } from '#cli/engine/plan.ts';
import { buildRunReport } from '#cli/engine/report.ts';
import { buildBaseResult, formatReproduceCommand, normalizeResultPaths, runBuiltInCheck } from '#cli/engine/results.ts';
import { openSession } from '#cli/engine/session.ts';
import { lookUpCommandTools, runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { remember } from '#cli/system/cache.ts';
import { CheckStop, GspotError } from '#cli/system/errors.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { buildArgumentPath, buildDashSafePath, convertToPosixPath, isInScope } from '#cli/system/paths.ts';
import { runProcess } from '#cli/system/processes.ts';
import { formatUnexpectedError } from '#cli/system/terminal.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { findMissingDependencies, findToolPath } from '#cli/tools/inspect.ts';
import { findMissingEnvironment } from '#cli/tools/python-environment.ts';
import type { PlannedCheck, RunSelection } from '#cli/types/engine/plan.ts';
import type {
    CheckCode,
    CheckGeneration,
    CheckResult,
    CheckRunOptions,
    CheckSession,
    PlanAfterFixes,
    Run,
    RunOptions,
    RunResult,
} from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

const DOCKER_AVAILABILITY = Symbol('docker availability');

const WRITTEN_FILES = Symbol('written files');

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
    if (result.end === 'canceled') return { status: 'canceled', note: CANCELED_CHECK_NOTE };
    return result.code === 0 ? undefined : { status: 'missing', note: DOCKER_DAEMON_NOTE };
}

async function findUnrunnableResult(
    session: CheckSession,
    planned: PlannedCheck,
    base: CheckResult,
): Promise<CheckResult | undefined> {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'canceled', note: CANCELED_CHECK_NOTE };
    const missing =
        findMissingEnvironment(session, planned) ??
        findMissingDependencies(session, planned) ??
        (await findMissingDocker(session, planned));
    return missing === undefined ? undefined : { ...base, ...missing };
}

function classifyCheckError(
    name: string,
    error: unknown,
    { isVerbose }: { isVerbose: boolean },
): Pick<CheckResult, 'status' | 'note' | 'cause' | 'stack'> {
    if (error instanceof CheckStop)
        return {
            status: error.status,
            ...(error.status === 'skipped' && { cause: error.skipCause ?? 'condition' }),
            note: error.message,
        };
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
        return await runCheckCode(session, planned, run.codes.get(planned), { verbose: run.options.verbose });
    } catch (error) {
        return {
            ...base,
            duration: Math.round(performance.now() - started),
            ...(session.cancelSignal?.aborted === true
                ? { status: 'canceled', note: CANCELED_CHECK_NOTE }
                : classifyCheckError(planned.check.id, error, { isVerbose: run.options.verbose === true })),
        };
    }
}

function buildWrittenPathMatcher(run: Run, result: CheckResult): (path: string) => boolean {
    const { session } = run;
    if (result.findings.length === 0 || result.check.startsWith(GSPOT_CHECK_PREFIX)) return () => false;
    return remember(session.cache, WRITTEN_FILES, session.root, () =>
        buildPathMatcher(session.generation.listWrittenGlobs(session)),
    );
}

function removeAcceptedFindings(run: Run, result: CheckResult): CheckResult {
    const { ignore } = run.session.settings;
    const isWritten = buildWrittenPathMatcher(run, result);
    const kept = result.findings.filter(
        (finding) =>
            !isWritten(finding.file) &&
            ignore.every((record) => {
                const isOtherFinding =
                    (record.check !== undefined && record.check !== finding.check) ||
                    (record.rule !== undefined && record.rule !== finding.rule && record.rule !== finding.fingerprint);
                return isOtherFinding || (record.paths !== undefined && !buildPathMatcher(record.paths)(finding.file));
            }),
    );
    if (!RAN_STATUSES.has(result.status)) return { ...result, findings: kept };
    return { ...result, findings: kept, status: kept.length > 0 ? 'failed' : 'passed' };
}

function removeOutsideFindings(result: CheckResult, run: Run): CheckResult {
    const { options, session } = run;
    if (options.paths === undefined) return result;
    const named = options.pathArguments.map((path) => buildArgumentPath(session.toolsRoot, options.cwd, path));
    return {
        ...result,
        findings: result.findings.filter(({ file }) => file === '' || named.some((path) => isInScope(file, path))),
    };
}

function findFixCommand(run: Run, result: CheckResult): Pick<CheckResult, 'fixCommand'> {
    const { options, session } = run;
    if (options.fix) return {};
    const listed = new Set(session.repository.files.map(({ path }) => path));
    const fixable = [
        ...new Set(
            result.findings.filter((finding) => finding.fixable && listed.has(finding.file)).map(({ file }) => file),
        ),
    ];
    const conflicted = new Set(listConflictedPaths(session.root, fixable));
    const files = new Set(fixable.filter((file) => !conflicted.has(file)));
    if (files.size === 0) return {};
    const command = [GSPOT_CHECK, FIX_FLAG, ONLY_FLAG, quoteArgument(result.check)];
    const isEveryFileChecked = options.paths === undefined && options.selection?.paths === undefined;
    if (isEveryFileChecked && result.findings.every(({ file }) => files.has(file)))
        return { fixCommand: command.join(' ') };
    const paths = [...files].map((file) => {
        const path = convertToPosixPath(relative(options.cwd, join(session.toolsRoot, file)));
        return quoteArgument(buildDashSafePath(path));
    });
    return { fixCommand: [...command, ...paths].join(' ') };
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
    await lookUpCommandTools(run.session, checks, run.codes);
    // Built-in checks hold the main thread, so they wait one turn of the event loop and the tools start first.
    const toolsStarted = setImmediate();
    const settled = await Promise.allSettled(
        checks.map(async (planned) => {
            if (run.codes.get(planned)?.check !== undefined) await toolsStarted;
            const result = finishResult(run, await runPlannedCheck(run, planned));
            run.progress.unfinished.delete(planned);
            run.options.onProgress?.({
                kind: 'finished',
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

async function runEveryActiveCheck(run: Run, checks: PlannedCheck[]): Promise<CheckResult[]> {
    const { progress, options } = run;
    const started = performance.now();
    const ticker = setInterval(() => {
        options.onProgress?.({
            kind: 'running',
            running: [...progress.unfinished].map(({ check, scope }) => ({ check: check.id, scope: scope.path })),
            elapsed: performance.now() - started,
            finished: progress.finished,
            total: progress.total,
            comparison: run.comparison,
        });
    }, PROGRESS_INTERVAL_MILLISECONDS);
    try {
        return await runActiveChecks(run, checks);
    } finally {
        clearInterval(ticker);
    }
}

async function planAfterFixes(session: CheckSession, options: RunOptions): Promise<PlanAfterFixes> {
    const planned = planChecks(session, options);
    if (!options.fix) return { session, planned, fixes: undefined };
    const fixes = await runFixers(session, planned, options.selectCheckCode);
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

export async function runChecks(session: Session, options: RunOptions): Promise<RunResult> {
    using _copies = holdCopyFolder(session.root);
    const started = options.started ?? new Date();
    const { selection } = options;
    const comparison =
        selection?.reference === undefined || selection.content === 'message'
            ? null
            : { content: selection.content, reference: selection.reference };
    const {
        session: checked,
        planned,
        fixes,
    } = await planAfterFixes(buildCheckSession(session, options.generation, selection), options);
    const active = planned.filter((check) => isActive(check, selection) && check.skip === undefined);
    const codes = new Map(active.map((check) => [check, options.selectCheckCode(check.check)]));
    const run: Run = {
        session: checked,
        options,
        comparison,
        codes,
        progress: { finished: 0, total: active.length, unfinished: new Set(active) },
    };
    const results = await runEveryActiveCheck(run, active);
    const report = buildRunReport({
        session: checked,
        options,
        comparison,
        started,
        planned,
        active,
        results,
        fixes,
    });
    return fixes ? { report, fixes } : { report };
}

export function buildCheckSession(
    session: Session,
    generation: CheckGeneration,
    selection?: RunSelection,
): CheckSession {
    return { ...session, generation, selection, limitProcess: pLimit(availableParallelism()) };
}

export async function runCheckCode(
    session: CheckSession,
    planned: PlannedCheck,
    code: CheckCode | undefined,
    options: CheckRunOptions,
): Promise<CheckResult> {
    if (code?.check !== undefined) return runBuiltInCheck(code.check, session, planned, options);
    if (code?.run === undefined) return runCommandCheck(session, planned, options);
    assertShippedCheck(planned);
    return code.run(session, planned, options);
}
