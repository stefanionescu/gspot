import pLimit from 'p-limit';
import { cpus } from 'node:os';
import { createTwoFilesPatch } from 'diff';
import { errorText } from '#cli/policy/public.ts';
import { inspectTool } from '#cli/tools/public.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readRepository } from '#cli/repository/public.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { planRun, isActive } from '#cli/planning/public.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { activeIgnores } from '#cli/policy/settings/public.ts';
import { createReadCache } from '#cli/platform/root/public.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { readIndexEntries } from '#cli/repository/contracts.ts';
import type { IgnoreEntry } from '#cli/types/policy/settings.ts';
import { toPosix, quoteArgument } from '#cli/platform/contracts.ts';
import { emptyResult, buildRunReport } from '#cli/execution/report.ts';
import type { ReproduceOptions } from '#cli/types/execution/reproduce.ts';
import { GspotError, environmentVariables } from '#cli/platform/public.ts';
import { copyIntoScratch, projectCopyInputs } from '#cli/execution/copy/public.ts';
import { checkRun, contentsOf, fixerPasses, changedPaths } from '#cli/execution/contracts.ts';
import { POLICY_CHECK, RAN_STATUSES, FAILED_STATUSES, FIX_DIFF_CONTEXT } from '#cli/config/execution/runtime.ts';

import type {
    Pass,
    FixReport,
    IgnoreUse,
    Executable,
    FixOptions,
    RunOptions,
    RunOutcome,
    CheckResult,
    IgnoredFindings,
    ReplannedFixResult,
} from '#cli/types/execution/check.ts';

// The wrong lines of gspot.toml that reading dropped, reported as one failed check so the rest of the run stands.
function policyErrorsResult(session: ToolSession): CheckResult | undefined {
    const { errors } = session.policyFiles;
    if (errors.length === 0) return undefined;
    const findings = errors.map((problem) => ({
        check: POLICY_CHECK,
        file: POLICY_FILE,
        message: errorText(problem),
        fixable: false,
    }));
    return { check: POLICY_CHECK, scope: '', status: 'failed', fileCount: 1, duration: 0, findings };
}

// The plan and, for each planned check, the function that runs it.
function planExecutables(session: ToolSession, options: RunOptions): Executable[] {
    const planned = planRun(session, options);
    return planned
        .filter(({ check }) => check.name !== POLICY_CHECK)
        .map((check) => ({ check, run: checkRun(check.check, options.checks) }));
}

// Rereads the repository after fixers changed it, so the run that follows sees the corrected files.
async function refreshAfterFixes(session: ToolSession, opened: ToolSession): Promise<void> {
    const { declarations, scope, exclude } = session.policyFiles.policy;
    const scopes = Object.entries(scope).map(([path, entry]) => ({ path, configurations: entry.configurations }));
    session.reads = createReadCache(session.root);
    session.repository = await readRepository(session.root, declarations, scopes, exclude, session.reads);
    opened.repository = session.repository;
    session.inspections.clear();
}

// The result of a check that cannot run: canceled, skipped by the plan, or in need of a Docker daemon.
function unrunnable(session: ToolSession, planned: PlannedCheck, base: CheckResult): CheckResult | undefined {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: 'The check was canceled.' };
    if (planned.skip) return { ...base, status: 'skipped', note: planned.skip.note };
    if (
        planned.check.needs?.includes('docker') === true &&
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
        return { ...base, duration: performance.now() - started, ...checkFailure(planned.check.name, error) };
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
    const countedFailure = check.check.finding_count_pattern !== undefined && result.status === 'failed';
    const ignored = applyIgnores(
        result.findings,
        ignores.filter((entry) => entry.check === check.check.name),
    );
    mergeUses(uses, ignored.uses);
    result.findings = ignored.kept;
    result.status = countedFailure || result.findings.length > 0 ? 'failed' : 'passed';
}

// Filters a result through the ignores and attaches the line that reproduces a failure.
function settleResult(pass: Pass, check: PlannedCheck, result: CheckResult): void {
    if (RAN_STATUSES.has(result.status)) dropIgnoredFindings(check, result, [...pass.uses.keys()], pass.uses);
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
        { isDryRun: options.isDryRun, checks: options.checks },
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
 * Runs fixes in passes and assembles their outcomes. Dry runs always remove the scratch copy.
 * @param session the session
 * @param planned the planned checks
 * @param options whether to run in a scratch copy and report diffs
 * @returns the fix results, changed paths, and dry-run diffs
 */
export async function applyFixers(
    session: ToolSession,
    planned: PlannedCheck[],
    options: FixOptions,
): Promise<FixReport> {
    const { isDryRun, checks: checksByName } = options;
    const checks = planned.filter(
        (check) => check.check.fix !== undefined || checksByName[check.check.name]?.fix !== undefined,
    );
    const paths = [
        ...new Set(checks.flatMap((check) => [...check.files.map((file) => file.path), ...check.triggerPaths])),
    ].toSorted((a, b) => a.localeCompare(b));
    using scratch = isDryRun
        ? await copyIntoScratch(
              projectCopyInputs(
                  session.root,
                  [...paths, ...session.repository.files.map((file) => file.path)],
                  session.repository.scopes.map((scope) => scope.path),
              ),
          )
        : undefined;
    const root = scratch?.path ?? session.root;
    const before = contentsOf(root, paths);
    const results = await fixerPasses(session, checks, root, paths, checksByName);
    const after = contentsOf(root, paths);
    const changed = changedPaths(before, after);
    const diffs = isDryRun
        ? changed.map((path) =>
              createTwoFilesPatch(
                  `a/${toPosix(path)}`,
                  `b/${toPosix(path)}`,
                  before.get(path)?.toString('utf8') ?? '',
                  after.get(path)?.toString('utf8') ?? '',
                  '',
                  '',
                  { context: FIX_DIFF_CONTEXT },
              ),
          )
        : [];
    return { results, changed, diffs };
}

/**
 * Runs the checks and returns the report.
 * @param opened the session
 * @param options stage, skips, and fix flags
 * @returns the report, the plan, and the fix report when --fix ran
 */
export async function executeRun(opened: ToolSession, options: RunOptions): Promise<RunOutcome> {
    using resources = new DisposableStack();
    const index = await readIndexEntries(opened.root, options.cancelSignal).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
    );
    const session: ToolSession = {
        ...opened,
        reads: createReadCache(opened.root),
        repository: {
            ...opened.repository,
            // Each consuming check reports the same failed read through its execution boundary.
            get index() {
                if ('error' in index) throw index.error;
                return index.value;
            },
        },
        resources,
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
    };
    session.inspections.clear();
    const started = new Date();
    const { executables, fixes } = await replanAfterFixes(session, opened, options);
    const planned = executables.map(({ check }) => check);
    const ignore = activeIgnores(session.policyFiles.policy);
    const pass: Pass = {
        session,
        options,
        staged: options.staged ? new Set(options.staged) : undefined,
        uses: new Map(ignore.map((entry) => [entry, { entry, matched: 0 }])),
    };
    const active = executables.filter(({ check }) => isActive(check) || check.skip?.cause === 'ignore');
    const ran = await runChecks(pass, active);
    const policyResult = options.stage === 'message' ? undefined : policyErrorsResult(session);
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

/**
 * The command that runs one check alone.
 * @param checkName the check ID.
 * @param scope the scope path, '' for the root.
 * @param options the message file or the exact push input.
 * @param options.push the pre-push input the check read.
 * @param options.push.stdin the lines Git handed the hook.
 * @param options.push.remote the remote name, when Git gave one.
 * @param options.messageFile the commit message file, which selects the message checks.
 * @param options.staged whether the finding used staged content.
 * @returns the command line.
 */
export function reproduceLine(checkName: string, scope: string, options: ReproduceOptions): string {
    const { push, messageFile: commitFile, staged } = options;
    if (push !== undefined) {
        const remote = push.remote === undefined ? '' : ` -- ${quoteArgument(push.remote)} ''`;
        return `printf '%s' ${quoteArgument(push.stdin)} | gspot check --hook pre-push --only ${quoteArgument(checkName)}${remote}`;
    }
    const parts = ['gspot check'];
    if (scope !== '') parts.push(quoteArgument(scope));
    parts.push('--only', quoteArgument(checkName));
    if (commitFile !== undefined) parts.push('--message-file', quoteArgument(commitFile));
    if (staged === true) parts.push('--staged');
    return parts.join(' ');
}
