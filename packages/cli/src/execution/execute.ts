// The orchestrator: plan, run, filter through ignores, report, decide the exit code.
import pLimit from 'p-limit';
import { cpus } from 'node:os';
import { inspectTool } from '#cli/tools/inspect.ts';
import { applyFixers } from '#cli/execution/fixers.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { checkExecution } from '#cli/execution/engines.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { reproduceLine } from '#cli/execution/reproduce.ts';
import { assembleReport } from '#cli/execution/run-report.ts';
import type { IgnoreEntry } from '#cli/types/policy/policy.ts';
import type { Finding, CheckResult } from '#cli/types/checks.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { DOCKER, RAN_STATUSES, FAILED_STATUSES, HISTORY_ANALYSES } from '#cli/config/execution/execution.ts';

import type {
    Pass,
    Session,
    FixReport,
    IgnoreUse,
    Executable,
    RunOptions,
    RunOutcome,
    PlannedCheck,
} from '#cli/types/execution/execution.ts';

// The plan and, for each planned check, the function that runs it.
function planExecutables(session: Session, options: RunOptions): Executable[] {
    const planned = planRun(session, options);
    return planned.map((check) => ({ check, run: checkExecution(check.spec) }));
}

// Rereads the repository after fixers changed it, so the run that follows sees the corrected files.
async function refreshAfterFixes(session: Session, opened: Session): Promise<void> {
    const { declarations, scopes, exclude } = session.policyFiles.policy;
    session.repository = await readRepository(session.root, declarations, scopes, exclude);
    opened.repository = session.repository;
    session.reads = { root: session.root, sources: new Map() };
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

// Runs one check.
async function runOne(pass: Pass, executable: Executable): Promise<CheckResult> {
    const { session, staged } = pass;
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
    return await run(session, planned, staged);
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

// The command that reruns one failed check with its original stage and staged flags.
function reproduceFor(check: PlannedCheck, result: CheckResult, options: RunOptions): string {
    const commitOptions = options.messageFile === undefined ? {} : { messageFile: options.messageFile };
    const line = reproduceLine(result.check, result.scope, { stage: check.spec.stage, ...commitOptions });
    return options.comparison?.content === 'index' ? `${line} --staged` : line;
}

// Drops the findings the ignores cover and settles the status on what remains.
function applyIgnoresTo(
    check: PlannedCheck,
    result: CheckResult,
    ignores: IgnoreEntry[],
    uses: Map<string, IgnoreUse>,
): void {
    const countedFailure = check.spec.count_regex !== undefined && result.status === 'fail';
    const ignored = applyIgnores(
        result.findings,
        ignores.filter((entry) => entry.check === check.check),
    );
    mergeUses(uses, ignored.uses);
    result.findings = ignored.kept;
    result.status = countedFailure || result.findings.length > 0 ? 'fail' : 'ok';
}

// Filters a result through the ignores and attaches the line that reproduces a failure.
function filterResult(pass: Pass, check: PlannedCheck, result: CheckResult): void {
    const { ignores } = pass.session.policyFiles.policy;
    if (RAN_STATUSES.has(result.status)) applyIgnoresTo(check, result, ignores, pass.uses);
    if (FAILED_STATUSES.has(result.status)) result.reproduce = reproduceFor(check, result, pass.options);
}

// Runs every active check under the job limit and reports each result as it settles.
async function runChecks(pass: Pass, executables: Executable[]): Promise<CheckResult[]> {
    const wanted = Number(environmentVariables()['GSPOT_JOBS'] ?? '');
    const jobs = Number.isSafeInteger(wanted) && wanted > 0 ? wanted : Math.max(1, cpus().length);
    const limiter = pLimit(jobs);
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

// The session of one run: fresh reads, a disposable stack for its resources, and the cancel signal.
function runSession(opened: Session, options: RunOptions, resources: DisposableStack): Session {
    const session = {
        ...opened,
        reads: { root: opened.root, sources: new Map<string, Buffer>() },
        resources,
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
    };
    session.inspections.clear();
    return session;
}

// The plan, replanned after fixers changed the repository so the run sees the corrected files.
async function planCorrections(
    session: Session,
    opened: Session,
    options: RunOptions,
): Promise<{ executables: Executable[]; fixes: FixReport | undefined }> {
    const executables = planExecutables(session, options);
    if (!options.fix) return { executables, fixes: undefined };
    const fixes = await applyFixers(
        session,
        executables.map(({ check }) => check),
        options.isDryRun,
    );
    if (options.isDryRun) return { executables, fixes };
    await refreshAfterFixes(session, opened);
    return { executables: planExecutables(session, options), fixes };
}

function isEntryMatch(entry: IgnoreEntry, finding: Finding): boolean {
    if (entry.check !== finding.check) return false;
    if (entry.rule !== undefined && entry.rule !== finding.rule) return false;
    return entry.paths === undefined || entry.paths.length === 0 || pathMatcher(entry.paths)(finding.file);
}

/**
 * Runs the checks and returns the report.
 * @param opened the session
 * @param options stage, skips, and fix flags
 * @returns the report, the plan, and the fix report when --fix ran
 */
export async function executeRun(opened: Session, options: RunOptions): Promise<RunOutcome> {
    using resources = new DisposableStack();
    const session = runSession(opened, options, resources);
    const started = new Date();
    const { executables, fixes } = await planCorrections(session, opened, options);
    const planned = executables.map(({ check }) => check);
    const { ignores } = session.policyFiles.policy;
    const pass: Pass = {
        session,
        options,
        staged: options.staged ? new Set(options.staged) : undefined,
        uses: new Map(ignores.map((entry) => [JSON.stringify(entry), { entry, matched: 0 }])),
    };
    const active = executables.filter(
        ({ check }) =>
            check.files.length > 0 ||
            check.triggerPaths.length > 0 ||
            check.spec.stage === 'message' ||
            (HISTORY_ANALYSES.has(check.spec.analysis ?? '') && (check.commits?.length ?? 0) > 0),
    );
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
    return fixes ? { report, planned, fixes } : { report, planned };
}

/**
 * Splits findings into kept and ignored, counting how many each entry matched.
 * @param findings the findings of one check
 * @param entries the [[ignore]] entries for that check
 * @returns the findings kept and the match count per entry
 */
export function applyIgnores(findings: Finding[], entries: IgnoreEntry[]): { kept: Finding[]; uses: IgnoreUse[] } {
    const uses: IgnoreUse[] = entries.map((entry) => ({ entry, matched: 0 }));
    const kept: Finding[] = [];
    for (const finding of findings) {
        const use = uses.find((candidate) => isEntryMatch(candidate.entry, finding));
        if (use) use.matched += 1;
        else kept.push(finding);
    }
    return { kept, uses };
}
