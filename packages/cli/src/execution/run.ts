import pLimit from 'p-limit';
import { availableParallelism } from 'node:os';
import { GspotError } from '#cli/system/errors.ts';
import { applyFixers } from '#cli/execution/fixes.ts';
import { readRepository } from '#cli/repository/read.ts';
import { findTool } from '#cli/execution/command/tool.ts';
import { planRun, isActive } from '#cli/planning/checks.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { IgnoreEntry } from '#cli/types/settings/file.ts';
import { listActiveIgnores } from '#cli/settings/scope-view.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { listFileDeclarations } from '#cli/repository/classify.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { DOCKER_TOOL } from '#cli/config/checks/infrastructure/docker.ts';
import { RAN_STATUSES, FAILED_STATUSES } from '#cli/config/execution/run.ts';
import { emptyResult, reproduceLine, buildRunReport } from '#cli/execution/report.ts';

import type {
    Finding,
    RunState,
    IgnoreUse,
    RunOptions,
    RunOutcome,
    CheckResult,
    RunnableCheck,
    ReplannedFixResult,
} from '#cli/types/execution/check.ts';

/**
 * Match an ignore record against a finding.
 *
 * @param entry the ignore record.
 * @param finding the finding to match.
 *
 * @returns whether the ignore covers this finding.
 */
function isEntryMatch(entry: IgnoreEntry, finding: Finding): boolean {
    if (entry.check !== finding.check) return false;
    if (entry.rule !== undefined && entry.rule !== finding.rule) return false;
    return entry.paths === undefined || entry.paths.length === 0 || buildPathMatcher(entry.paths)(finding.file);
}

// The plan and, for each planned check, the function that runs it.
function planChecks(session: Session, options: RunOptions): RunnableCheck[] {
    const planned = planRun(session, options);
    return planned.map((check) => {
        const builtIn = options.checks[check.check.name];
        return {
            check,
            run: builtIn?.run ?? runCheckCommand,
            arguments: builtIn?.arguments,
            configurationFiles: builtIn?.configurationFiles,
        };
    });
}

// Rereads the repository after fixers changed it, so the next run checks the corrected files.
async function refreshAfterFixes(session: Session): Promise<void> {
    const { scope } = session.settingsFile.settings;
    const scopes = Object.entries(scope).map(([path, { configurations }]) => ({ path, configurations }));
    session.reads = createReadCache(session.root);
    const selected = new Map(session.scopes.map((selection) => [selection.scope.path, selection.selected]));
    session.repository = await readRepository(session.reads, {
        declarations: listFileDeclarations(selected),
        scopeEntries: scopes,
        manifests: session.manifests,
    });
    session.packageManifests = session.repository.dependencyFiles;
    session.inspections.clear();
}

// The result of a check that cannot run: canceled, skipped by the plan, or Docker has no installation.
function unrunnable(session: Session, planned: PlannedCheck, base: CheckResult): CheckResult | undefined {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: 'The check was canceled.' };
    if (planned.skip) return { ...base, status: 'skipped', note: planned.skip.note };
    if (
        planned.check.needs?.includes(DOCKER_TOOL) === true &&
        'status' in findTool(session, session.root, getToolDeclaration(session.manifests.values(), DOCKER_TOOL))
    )
        return { ...base, status: 'missing', note: 'Docker has no installation. Install Docker to run this check.' };
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
async function runOne(pass: RunState, executable: RunnableCheck): Promise<CheckResult> {
    const { session, staged } = pass;
    const { check: planned, run } = executable;
    const base = emptyResult(planned);
    const early = unrunnable(session, planned, base);
    if (early) return early;
    const started = performance.now();
    // Each thrown failure belongs to this check; the other results of the run survive.
    try {
        return await run(session, planned, {
            arguments: executable.arguments,
            configurationFiles: executable.configurationFiles,
            ...(staged === undefined ? {} : { staged }),
        });
    } catch (error) {
        return { ...base, duration: performance.now() - started, ...checkFailure(planned.check.name, error) };
    }
}

// Drops the findings the ignores cover and settles the status on what remains.
function dropIgnoredFindings(check: PlannedCheck, result: CheckResult, uses: Map<IgnoreEntry, IgnoreUse>): void {
    result.findings = result.findings.filter((finding) => {
        const use = uses.values().find(({ entry }) => entry.check === check.check.name && isEntryMatch(entry, finding));
        if (use === undefined) return true;
        use.matched += 1;
        return false;
    });
    result.status = result.findings.length > 0 ? 'failed' : 'passed';
}

// Filters a result through the ignores and attaches the line that reproduces a failure.
function settleResult(pass: RunState, check: PlannedCheck, result: CheckResult): void {
    if (RAN_STATUSES.has(result.status)) dropIgnoredFindings(check, result, pass.uses);
    if (FAILED_STATUSES.has(result.status))
        result.reproduce = reproduceLine(result.check, result.scope, {
            ...(pass.options.messageFile === undefined ? {} : { messageFile: pass.options.messageFile }),
            ...(pass.options.push === undefined ? {} : { push: pass.options.push }),
            staged: pass.options.comparison?.content === 'index',
        });
}

// Runs every active check under the job limit and reports each result as it settles.
async function runChecks(pass: RunState, executables: RunnableCheck[]): Promise<CheckResult[]> {
    const limiter = pLimit(availableParallelism());
    // runOne catches check errors; these rejections cover ignore matching and onResult callbacks before resource disposal.
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

// The plan, replanned after fixers changed the repository so the run checks the corrected files.
async function replanAfterFixes(session: Session, options: RunOptions): Promise<ReplannedFixResult> {
    const executables = planChecks(session, options);
    if (!options.fix) return { executables, fixes: undefined };
    const fixes = await applyFixers(
        session,
        executables.map(({ check }) => check),
        { isDryRun: options.isDryRun, checks: options.checks },
    );
    if (options.isDryRun) return { executables, fixes };
    await refreshAfterFixes(session);
    return { executables: planChecks(session, options), fixes };
}

/**
 * Runs the checks and returns the report.
 *
 * @param opened the session.
 * @param options stage, skips, and fix flags.
 *
 * @returns the report, the plan, and the fix report when --fix ran.
 */
export async function executeRun(opened: Session, options: RunOptions): Promise<RunOutcome> {
    using resources = new DisposableStack();
    const session: Session = {
        ...opened,
        repository: opened.repository,
        resources,
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
    };
    const started = new Date();
    const { executables, fixes } = await replanAfterFixes(session, options);
    const planned = executables.map(({ check }) => check);
    const ignore = listActiveIgnores(session.settingsFile.settings);
    const pass: RunState = {
        session,
        options,
        staged: options.staged ? new Set(options.staged) : undefined,
        uses: new Map(ignore.map((entry) => [entry, { entry, matched: 0 }])),
    };
    const active = executables.filter(({ check }) => isActive(check) || check.skip?.cause === 'ignore');
    const ran = await runChecks(pass, active);
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
