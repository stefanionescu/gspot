import pLimit from 'p-limit';
import { availableParallelism } from 'node:os';
import type { Session } from '#cli/types/tools.ts';
import { setImmediate } from 'node:timers/promises';
import { runFixers } from '#cli/engine/run/fixes.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildRunReport } from '#cli/engine/run/report.ts';
import { CheckStop, GspotError } from '#cli/system/errors.ts';
import { holdCopyFolder } from '#cli/engine/copies/folders.ts';
import { formatUnexpectedError } from '#cli/system/terminal.ts';
import { CANCELED_CHECK_NOTE } from '#cli/config/tools/programs.ts';
import { PROGRESS_INTERVAL_MILLISECONDS } from '#cli/config/engine.ts';
import { finishResult, buildBaseResult } from '#cli/engine/results.ts';
import type { PlannedCheck, RunSelection } from '#cli/types/engine/plan.ts';
import { isActive, planChecks, assertShippedCheck } from '#cli/engine/plan/checks.ts';
import { runCommandCheck, lookUpCommandTools } from '#cli/engine/run/tool-runs/check.ts';
import { findMissingDocker, findMissingEnvironment, findMissingDependencies } from '#cli/tools/missing.ts';

import type {
    Run,
    CheckCode,
    RunResult,
    RunOptions,
    CheckResult,
    BuiltInCheck,
    CheckSession,
    PlanAfterFixes,
    CheckGeneration,
    CheckRunOptions,
} from '#cli/types/engine/run.ts';

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

export async function runBuiltInCheck(
    builtInCheck: BuiltInCheck,
    session: CheckSession,
    planned: PlannedCheck,
    options: CheckRunOptions,
): Promise<CheckResult> {
    await setImmediate();
    const started = performance.now();
    const result = await builtInCheck(session, planned, options);
    const findings = (Array.isArray(result) ? result : result.findings).map((finding) => ({
        ...finding,
        check: planned.check.id,
        fixable: finding.fixable === true,
    }));
    const files = Array.isArray(result) ? undefined : [...new Set(result.files)];
    return {
        ...buildBaseResult(planned, session),
        findings,
        ...(files !== undefined && { files, fileCount: files.length }),
        ...(!Array.isArray(result) && result.notes !== undefined && { reportNotes: result.notes }),
        status: findings.length > 0 ? 'failed' : 'passed',
        duration: Math.round(performance.now() - started),
    };
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
