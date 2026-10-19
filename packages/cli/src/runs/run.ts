import pLimit from 'p-limit';
import { runFixers } from '#cli/runs/fixes.ts';
import { availableParallelism } from 'node:os';
import { GspotError } from '#cli/system/errors.ts';
import { findTool } from '#cli/runs/command/tool.ts';
import { buildCheckRun } from '#cli/runs/check-run.ts';
import { readRepository } from '#cli/repository/read.ts';
import { DOCKER_TOOL } from '#cli/config/checks/docker.ts';
import { planRun, isActive } from '#cli/planning/checks.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listActiveIgnores } from '#cli/settings/scope-view.ts';
import type { IgnoreRecord } from '#cli/types/settings/file.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { listFileDeclarations } from '#cli/repository/classify.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { buildRunReport, buildBaseResult, formatReproduceCommand } from '#cli/runs/report.ts';
import { RAN_STATUSES, FAILED_STATUSES, DOCKER_MISSING_MESSAGE } from '#cli/config/runs/run.ts';

import {
    type Finding,
    type RunState,
    type IgnoreUse,
    type RunResult,
    type RunOptions,
    type CheckResult,
    type RunnableCheck,
    type PlanAfterFixes,
} from '#cli/types/runs/check.ts';

// An ignore with names covers only the findings that name one of those functions.
function isNameMatch(record: IgnoreRecord, finding: Finding): boolean {
    return record.names === undefined || (finding.name !== undefined && record.names.includes(finding.name));
}

/**
 * Checks whether an ignore record covers a finding.
 * @param record one `[[ignore]]` entry of gspot.toml.
 * @param finding what a check reported.
 * @returns whether the ignore covers this finding.
 */
function isIgnoreMatch(record: IgnoreRecord, finding: Finding): boolean {
    if (record.check !== undefined && record.check !== finding.check) return false;
    if (record.rule !== undefined && record.rule !== finding.rule) return false;
    if (!isNameMatch(record, finding)) return false;
    return record.paths === undefined || record.paths.length === 0 || buildPathMatcher(record.paths)(finding.file);
}

function planChecks(session: Session, options: RunOptions): RunnableCheck[] {
    return planRun(session, options).map((check) => ({
        check,
        run: buildCheckRun(options.selectImplementation(check.check)),
    }));
}

// Rereads the repository after fixers changed it, so the next run checks the corrected files.
async function refreshAfterFixes(session: Session): Promise<void> {
    const { scopes: tables } = session.settingsFile.settings;
    const scopes = Object.entries(tables).map(([path, { configurations }]) => ({ path, configurations }));
    session.reads = createReadCache(session.root);
    const selected = new Map(session.scopes.map((selection) => [selection.scope.path, selection.selected]));
    session.repository = await readRepository(session.reads, {
        declarations: listFileDeclarations(selected),
        scopes: scopes,
        manifests: session.manifests,
    });
    session.inspections.clear();
}

// The result of a check that cannot run: canceled, skipped by the plan, or without Docker.
function findUnrunnableResult(session: Session, planned: PlannedCheck, base: CheckResult): CheckResult | undefined {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: 'The check was canceled.' };
    if (planned.skip) return { ...base, status: 'skipped', note: planned.skip.note };
    if (planned.check.needs?.includes('docker') !== true) return undefined;
    return 'status' in findTool(session, session.root, getToolDeclaration(session.manifests.values(), DOCKER_TOOL))
        ? { ...base, status: 'missing', note: DOCKER_MISSING_MESSAGE }
        : undefined;
}

function checkFailure(name: string, error: unknown): Pick<CheckResult, 'status' | 'note'> {
    if (error instanceof GspotError && error.code === 'skip') return { status: 'skipped', note: error.message };
    if (error instanceof GspotError && error.code === 'tool') return { status: 'missing', note: error.message };
    return {
        status: 'error',
        note: `The ${name} check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
}

async function runOne(runState: RunState, executable: RunnableCheck): Promise<CheckResult> {
    const { session, staged } = runState;
    const { check: planned, run } = executable;
    const base = buildBaseResult(planned, session);
    const early = findUnrunnableResult(session, planned, base);
    if (early) return early;
    const started = performance.now();
    // Each thrown failure belongs to this check; the other results of the run survive.
    try {
        return await run(session, planned, staged === undefined ? {} : { staged });
    } catch (error) {
        return { ...base, duration: performance.now() - started, ...checkFailure(planned.check.name, error) };
    }
}

function dropIgnoredFindings(result: CheckResult, uses: Map<IgnoreRecord, IgnoreUse>): void {
    result.findings = result.findings.filter((finding) => {
        const use = uses.values().find(({ record }) => isIgnoreMatch(record, finding));
        if (use === undefined) return true;
        use.matched += 1;
        return false;
    });
    result.status = result.findings.length > 0 ? 'failed' : 'passed';
}

// A project-wide check reads the whole project. Path arguments drop its findings in the other tracked files. Findings
// without a file stay, and so do findings in an untracked file, such as the build output that a site check reads.
function dropOutsideFindings(result: CheckResult, runState: RunState): void {
    const { options, session } = runState;
    if (options.paths === undefined || options.staged !== undefined) return;
    const paths = new Set(options.paths);
    const tracked = new Set(session.repository.files.map((file) => file.path));
    result.findings = result.findings.filter((finding) => paths.has(finding.file) || !tracked.has(finding.file));
}

function filterResult(runState: RunState, result: CheckResult): void {
    if (RAN_STATUSES.has(result.status)) {
        dropOutsideFindings(result, runState);
        dropIgnoredFindings(result, runState.uses);
    }
    if (FAILED_STATUSES.has(result.status))
        result.reproduce = formatReproduceCommand(result.check, result.scope, {
            ...(runState.options.messageFile === undefined ? {} : { messageFile: runState.options.messageFile }),
            ...(runState.options.push === undefined ? {} : { push: runState.options.push }),
            staged: runState.options.comparison?.content === 'index',
        });
}

async function runActiveChecks(runState: RunState, executables: RunnableCheck[]): Promise<CheckResult[]> {
    const limiter = pLimit(availableParallelism());
    let completed = 0;
    // runOne catches check errors; these rejections cover ignore matching and onResult callbacks before resource disposal.
    const settled = await Promise.allSettled(
        executables.map((executable) =>
            limiter(async () => {
                const result = await runOne(runState, executable);
                filterResult(runState, result);
                runState.options.onResult?.(result, {
                    completed: ++completed,
                    total: executables.length,
                    comparison: runState.options.comparison,
                });
                return result;
            }),
        ),
    );
    return settled.map((result) => {
        if (result.status === 'rejected') throw result.reason;
        return result.value;
    });
}

async function planAfterFixes(session: Session, options: RunOptions): Promise<PlanAfterFixes> {
    const executables = planChecks(session, options);
    if (!options.fix) return { executables, fixes: undefined };
    const fixes = await runFixers(
        session,
        executables.map(({ check }) => check),
        { isDryRun: options.isDryRun, selectImplementation: options.selectImplementation },
    );
    if (options.isDryRun) return { executables, fixes };
    await refreshAfterFixes(session);
    return { executables: planChecks(session, options), fixes };
}

/**
 * Runs the checks and returns the report.
 * @param opened the repository and its tools.
 * @param options stage, skips, and fix flags.
 * @returns the report, the plan, and the fix report when --fix ran.
 */
async function runChecks(opened: Session, options: RunOptions): Promise<RunResult> {
    using resources = new DisposableStack();
    const session: Session = {
        ...opened,
        resources,
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
    };
    const started = new Date();
    const { executables, fixes } = await planAfterFixes(session, options);
    const planned = executables.map(({ check }) => check);
    const ignore = listActiveIgnores(session.settingsFile.settings);
    const runState: RunState = {
        session,
        options,
        staged: options.staged ? new Set(options.staged) : undefined,
        uses: new Map(ignore.map((record) => [record, { record, matched: 0 }])),
    };
    const active = executables.filter(({ check }) => isActive(check) || check.skip?.cause === 'ignore');
    const ran = await runActiveChecks(runState, active);
    const report = buildRunReport({
        session,
        options,
        started,
        planned,
        active: active.map(({ check }) => check),
        ran,
        uses: runState.uses,
        fixes,
    });
    return fixes ? { report, planned, fixes } : { report, planned };
}

export { runChecks };
