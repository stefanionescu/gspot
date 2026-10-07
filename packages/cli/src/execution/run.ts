// The orchestrator: plan, run, filter through ignores, report, decide the exit code.
import pLimit from 'p-limit';
import { cpus } from 'node:os';
import { problemText } from '#cli/policy/read.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { applyFixers } from '#cli/execution/fixers.ts';
import { readRepository } from '#cli/repository/read.ts';
import { planRun, isActive } from '#cli/planning/plan.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { getCheckRunner } from '#cli/execution/engines.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { reproduceLine } from '#cli/execution/reproduce.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { IgnoreEntry } from '#cli/types/policy/settings.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { emptyResult, buildRunReport } from '#cli/execution/report.ts';
import { POLICY_CHECK, RAN_STATUSES, FAILED_STATUSES } from '#cli/config/execution/runtime.ts';

import type {
    Pass,
    IgnoreUse,
    Executable,
    RunOptions,
    RunOutcome,
    CheckResult,
    IgnoredFindings,
    ReplannedFixResult,
} from '#cli/types/execution/runtime.ts';

// The wrong lines of gspot.toml that reading dropped, reported as one failed check so the rest of the run stands.
function policyProblemsResult(session: ToolSession): CheckResult | undefined {
    const { problems } = session.policyFiles;
    if (problems.length === 0) return undefined;
    const findings = problems.map((problem) => ({
        check: POLICY_CHECK,
        file: POLICY_FILE,
        message: problemText(problem),
        fixable: false,
    }));
    return { check: POLICY_CHECK, scope: '', status: 'failed', fileCount: 1, duration: 0, findings };
}

// The plan and, for each planned check, the function that runs it.
function planExecutables(session: ToolSession, options: RunOptions): Executable[] {
    const planned = planRun(session, options);
    return planned.map((check) => ({ check, run: getCheckRunner(check.spec, options.checks) }));
}

// Rereads the repository after fixers changed it, so the run that follows sees the corrected files.
async function refreshAfterFixes(session: ToolSession, opened: ToolSession): Promise<void> {
    const { declarations, scopes, exclude } = session.policyFiles.policy;
    session.repository = await readRepository(session.root, declarations, scopes, exclude);
    opened.repository = session.repository;
    session.reads = { root: session.root, sources: new Map(), memo: new Map() };
    session.inspections.clear();
}

// The result of a check that cannot run: canceled, skipped by the plan, or in need of a Docker daemon.
function unrunnable(session: ToolSession, planned: PlannedCheck, base: CheckResult): CheckResult | undefined {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: 'The check was canceled.' };
    if (planned.skip) return { ...base, status: 'skipped', note: planned.skip.note };
    if (
        planned.spec.needs?.includes('docker') === true &&
        inspectTool(session, toolPin(session.manifests.values(), 'docker')).state === 'missing'
    )
        return { ...base, status: 'missing', note: 'Docker is not installed. Install Docker to run this check.' };
    return undefined;
}

// Classify thrown failures at the boundary of each check.
function checkFailure(name: string, error: unknown): Pick<CheckResult, 'status' | 'note'> {
    if (error instanceof GspotError && error.code === 'skip') return { status: 'skipped', note: error.message };
    if (error instanceof GspotError && error.code === 'tool') return { status: 'missing', note: error.message };
    return {
        status: 'error',
        note: `The ${name} check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
}

// Runs one check.
async function runOne(pass: Pass, executable: Executable): Promise<CheckResult> {
    const { session, staged } = pass;
    const { check: planned, run } = executable;
    const base = emptyResult(planned);
    const early = unrunnable(session, planned, base);
    if (early) return early;
    const started = performance.now();
    // Each thrown failure belongs to this check; the other results of the run survive.
    try {
        return await run(session, planned, staged === undefined ? undefined : { staged });
    } catch (error) {
        return { ...base, duration: performance.now() - started, ...checkFailure(planned.spec.name, error) };
    }
}

// Adds the findings each ignore entry matched to the run's tally.
function mergeUses(into: Map<IgnoreEntry, IgnoreUse>, uses: IgnoreUse[]): void {
    for (const use of uses) {
        const existing = into.get(use.entry) as IgnoreUse;
        existing.matched += use.matched;
    }
}

// Drops the findings the ignores cover and settles the status on what remains.
function dropIgnoredFindings(
    check: PlannedCheck,
    result: CheckResult,
    ignores: IgnoreEntry[],
    uses: Map<IgnoreEntry, IgnoreUse>,
): void {
    const countedFailure = check.spec.finding_count_pattern !== undefined && result.status === 'failed';
    const ignored = applyIgnores(
        result.findings,
        ignores.filter((entry) => entry.check === check.spec.name),
    );
    mergeUses(uses, ignored.uses);
    result.findings = ignored.kept;
    result.status = countedFailure || result.findings.length > 0 ? 'failed' : 'passed';
}

// Filters a result through the ignores and attaches the line that reproduces a failure.
function settleResult(pass: Pass, check: PlannedCheck, result: CheckResult): void {
    const { ignores } = pass.session.policyFiles.policy;
    if (RAN_STATUSES.has(result.status)) dropIgnoredFindings(check, result, ignores, pass.uses);
    if (FAILED_STATUSES.has(result.status))
        result.reproduce = reproduceLine(result.check, result.scope, {
            ...(pass.options.messageFile === undefined ? {} : { messageFile: pass.options.messageFile }),
            staged: pass.options.comparison?.content === 'index',
        });
}

// Runs every active check under the job limit and reports each result as it settles.
async function runChecks(pass: Pass, executables: Executable[]): Promise<CheckResult[]> {
    const wanted = Number(environmentVariables()['GSPOT_JOBS'] ?? '');
    const jobs = Number.isSafeInteger(wanted) && wanted > 0 ? wanted : Math.max(1, cpus().length);
    const limiter = pLimit(jobs);
    // Every check settles before executeRun disposes shared resources, including when one check rejects.
    const settled = await Promise.allSettled(
        executables.map((executable) =>
            limiter(async () => {
                const result = await runOne(pass, executable);
                settleResult(pass, executable.check, result);
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
function runSession(opened: ToolSession, options: RunOptions, resources: DisposableStack): ToolSession {
    const session = {
        ...opened,
        reads: { root: opened.root, sources: new Map<string, Buffer>(), memo: new Map() },
        resources,
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
    };
    session.inspections.clear();
    return session;
}

// The plan, replanned after fixers changed the repository so the run sees the corrected files.
async function replanAfterFixes(
    session: ToolSession,
    opened: ToolSession,
    options: RunOptions,
): Promise<ReplannedFixResult> {
    const executables = planExecutables(session, options);
    if (!options.fix) return { executables, fixes: undefined };
    const fixes = await applyFixers(
        session,
        executables.map(({ check }) => check),
        { isDryRun: options.isDryRun },
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
export async function executeRun(opened: ToolSession, options: RunOptions): Promise<RunOutcome> {
    using resources = new DisposableStack();
    const session = runSession(opened, options, resources);
    const started = new Date();
    const { executables, fixes } = await replanAfterFixes(session, opened, options);
    const planned = executables.map(({ check }) => check);
    const { ignores } = session.policyFiles.policy;
    const pass: Pass = {
        session,
        options,
        staged: options.staged ? new Set(options.staged) : undefined,
        uses: new Map(ignores.map((entry) => [entry, { entry, matched: 0 }])),
    };
    const active = executables.filter(({ check }) => isActive(check));
    const ran = await runChecks(pass, active);
    const policyResult = options.stage === 'message' ? undefined : policyProblemsResult(session);
    if (policyResult !== undefined) {
        options.onResult?.(policyResult);
        ran.push(policyResult);
    }
    const report = buildRunReport({
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
export function applyIgnores(findings: Finding[], entries: IgnoreEntry[]): IgnoredFindings {
    const uses: IgnoreUse[] = entries.map((entry) => ({ entry, matched: 0 }));
    const kept: Finding[] = [];
    for (const finding of findings) {
        const use = uses.find((candidate) => isEntryMatch(candidate.entry, finding));
        if (use) use.matched += 1;
        else kept.push(finding);
    }
    return { kept, uses };
}
