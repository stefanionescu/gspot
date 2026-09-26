// The orchestrator: plan, run, filter through ignores, report, decide the exit code.
import pLimit from 'p-limit';
import { cpus } from 'node:os';
import { inspectTool } from '#cli/tools/inspect.ts';
import { pruneCache } from '#cli/execution/cache.ts';
import { applyFixers } from '#cli/execution/fixers.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { resolveCheck } from '#cli/execution/engines.ts';
import { jobsWanted } from '#cli/platform/environment.ts';
import { isActive, planRun } from '#cli/execution/planning/plan.ts';
import { reproduceLine } from '#cli/execution/reproduce.ts';
import { assembleReport } from '#cli/execution/run-report.ts';
import type { CheckResult } from '#cli/types/checks/checks.ts';
import type { IgnoreEntry } from '#cli/types/policy/policy.ts';
import { applyIgnores, applyInlineIgnores } from '#cli/execution/ignores.ts';
import type { SourceObservations } from '#cli/types/repository/repository.ts';
import { DOCKER, FAILED_STATUSES, RAN_STATUSES } from '#cli/constants/execution/execution.ts';
import { cachedResult, cacheKeyFor, runHashes, storeResult } from '#cli/execution/result-cache.ts';

import type {
    Executable,
    Pass,
    RunOptions,
    RunOutcome,
    FixReport,
    IgnoreUse,
    PlannedCheck,
    RunReport,
    Session,
} from '#cli/types/execution/execution.ts';

// The plan and, for each planned check, the function that runs it.
async function planExecutables(session: Session, options: RunOptions): Promise<Executable[]> {
    const planned = await planRun(session, options);
    return planned.map((check) => ({ check, run: resolveCheck(check.spec) }));
}

// Rereads the repository after fixers changed it, so the run that follows sees the corrected files.
async function refreshAfterFixes(session: Session, opened: Session): Promise<void> {
    const { declarations, scopes, exclude } = session.policyFiles.policy;
    session.repository = await readRepository(session.root, declarations, scopes, exclude);
    opened.repository = session.repository;
    session.observations = { root: session.root, sources: new Map() };
    session.inspections.clear();
}

// The result of a check that cannot run: canceled, skipped by the plan, or in need of a Docker daemon.
function unrunnable(session: Session, planned: PlannedCheck, base: CheckResult): CheckResult | undefined {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: 'The check was canceled.' };
    if (planned.skip) return { ...base, status: 'skipped', note: planned.skip.note };
    if (planned.spec.requires === 'docker' && inspectTool(session, DOCKER).state === 'missing')
        return { ...base, status: 'missing', note: 'this check needs a Docker daemon and docker is not installed' };
    return undefined;
}

// Runs one check, serving its stored result when the inputs are unchanged and storing a fresh one otherwise.
async function runOne(pass: Pass, executable: Executable): Promise<CheckResult> {
    const { session, options, hashes, staged } = pass;
    const { check: planned, run } = executable;
    const base: CheckResult = {
        check: planned.check,
        scope: planned.scope.scope.path,
        status: 'ok',
        files: planned.files.length,
        duration: 0,
        findings: [],
    };
    const early = unrunnable(session, planned, base);
    if (early) return early;
    const key = options.noCache === true ? undefined : cacheKeyFor(session, planned, hashes);
    const cached = key === undefined ? undefined : cachedResult(session, key, planned);
    if (cached) return cached;
    const result = await run(session, planned, staged);
    if (key !== undefined && !options.isDryRun) storeResult(session, key, result);
    return result;
}

// Adds the findings each ignore entry matched to the run's tally.
function mergeUses(into: Map<string, IgnoreUse>, uses: IgnoreUse[]): void {
    for (const use of uses) {
        const key = JSON.stringify(use.entry);
        const existing = into.get(key) ?? { entry: use.entry, matched: 0 };
        existing.matched += use.matched;
        into.set(key, existing);
    }
}

// The command line that reruns a failed check alone, with the stage and staged flags it ran under.
function reproduceFor(check: PlannedCheck, result: CheckResult, options: RunOptions): string {
    const messageFile = options.messageFile === undefined ? {} : { messageFile: options.messageFile };
    const line = reproduceLine(result.check, result.scope, { stage: check.spec.stage, ...messageFile });
    return options.comparison?.content === 'index' ? `${line} --staged` : line;
}

// Drops the findings the ignores cover and settles the status on what remains.
function applyIgnoresTo(
    observations: SourceObservations,
    check: PlannedCheck,
    result: CheckResult,
    ignores: IgnoreEntry[],
    uses: Map<string, IgnoreUse>,
): void {
    const countedFailure = check.spec.count_regex !== undefined && result.status === 'fail';
    const inline = applyInlineIgnores(observations, result.findings);
    const ignored = applyIgnores(
        inline,
        ignores.filter((entry) => entry.check === check.check),
    );
    mergeUses(uses, ignored.uses);
    result.findings = ignored.kept;
    if (countedFailure || result.findings.length > 0) result.status = 'fail';
    else if (result.status !== 'cache') result.status = 'ok';
}

// Filters a result through the ignores and attaches the line that reproduces a failure.
function filterResult(pass: Pass, check: PlannedCheck, result: CheckResult): void {
    const { ignores } = pass.session.policyFiles.policy;
    if (RAN_STATUSES.has(result.status)) applyIgnoresTo(pass.session.observations, check, result, ignores, pass.uses);
    if (FAILED_STATUSES.has(result.status)) result.reproduce = reproduceFor(check, result, pass.options);
}

// Runs every active check under the job limit and reports each result as it settles.
async function runChecks(pass: Pass, executables: Executable[]): Promise<CheckResult[]> {
    const limiter = pLimit(jobsWanted() ?? Math.max(1, cpus().length));
    const settled = await Promise.allSettled(
        executables.map((executable) =>
            limiter(async () => {
                const result = await runOne(pass, executable);
                filterResult(pass, executable.check, result);
                pass.options.onResult?.(result);
                return result;
            }),
        ),
    );
    return settled.map((result) => {
        if (result.status === 'rejected') throw result.reason;
        return result.value;
    });
}

// The session of one run: fresh observations, a disposable stack for its resources, and the cancel signal.
function runSession(opened: Session, options: RunOptions, resources: DisposableStack): Session {
    const session = {
        ...opened,
        observations: { root: opened.root, sources: new Map<string, Buffer>() },
        resources,
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
    };
    session.inspections.clear();
    return session;
}

// The plan, replanned after fixers changed the repository so the run sees the corrected files.
async function planWithFixes(
    session: Session,
    opened: Session,
    options: RunOptions,
): Promise<{ executables: Executable[]; fixes: FixReport | undefined }> {
    const executables = await planExecutables(session, options);
    if (!options.fix) return { executables, fixes: undefined };
    const fixes = await applyFixers(
        session,
        executables.map(({ check }) => check),
        options.isDryRun,
    );
    if (options.isDryRun) return { executables, fixes };
    await refreshAfterFixes(session, opened);
    return { executables: await planExecutables(session, options), fixes };
}

// Whether a run covered the whole repository with live results, so stale cache entries can go.
function isPruneWorthy(options: RunOptions, report: RunReport): boolean {
    if (options.isDryRun || options.noCache === true) return false;
    return options.stage === 'all' && !report.narrowed;
}

/**
 * Runs the checks and returns the report. Writes .gspot/reports/report.json.
 * @param opened the session
 * @param options stage, skips, fix and cache flags
 * @returns the report, the plan, and the fix report when --fix ran
 */
export async function executeRun(opened: Session, options: RunOptions): Promise<RunOutcome> {
    using resources = new DisposableStack();
    const session = runSession(opened, options, resources);
    const started = new Date();
    const { executables, fixes } = await planWithFixes(session, opened, options);
    const planned = executables.map(({ check }) => check);
    const { ignores } = session.policyFiles.policy;
    const pass: Pass = {
        session,
        options,
        hashes: runHashes(session),
        staged: options.staged ? new Set(options.staged) : undefined,
        uses: new Map(ignores.map((entry) => [JSON.stringify(entry), { entry, matched: 0 }])),
    };
    const active = executables.filter(({ check }) => isActive(check));
    const ran = await runChecks(pass, active);
    const report = assembleReport({
        session,
        options,
        started,
        planned,
        active: active.map(({ check }) => check),
        ran,
        uses: pass.uses,
        fixes,
    });
    if (isPruneWorthy(options, report)) pruneCache(session.cacheRoot ?? session.root);
    return fixes ? { report, planned, fixes } : { report, planned };
}
