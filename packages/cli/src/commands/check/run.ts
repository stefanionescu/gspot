import pLimit from 'p-limit';
import { availableParallelism } from 'node:os';
import { GspotError } from '#cli/system/errors.ts';
import { findCheckCode } from '#cli/checks/code.ts';
import { findTool } from '#cli/runs/command/tool.ts';
import type { Session } from '#cli/types/session.ts';
import { runBuiltInCheck } from '#cli/runs/built-in.ts';
import { readSessionRepository } from '#cli/session.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { DOCKER_TOOL } from '#cli/config/checks/docker.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { isActive, planChecks } from '#cli/planning/checks.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import type { IgnoreRecord } from '#cli/types/settings/file.ts';
import { buildRunReport, buildBaseResult, formatReproduceCommand } from '#cli/runs/report.ts';
import type { RunState, RunResult, RunOptions, PlanAfterFixes } from '#cli/types/runs/run.ts';
import { RAN_STATUSES, FAILED_STATUSES, DOCKER_MISSING_MESSAGE } from '#cli/config/runs/run.ts';
import type { Finding, CheckCode, CheckResult, CheckRunOptions } from '#cli/types/runs/check.ts';

/**
 * Checks whether an ignore record covers a finding.
 *
 * @param record one `[[ignore]]` entry of gspot.toml.
 * @param finding what a check reported.
 * @returns whether the ignore covers this finding.
 */
function isIgnoreMatch(record: IgnoreRecord, finding: Finding): boolean {
    if ((['check', 'rule'] as const).some((key) => record[key] !== undefined && record[key] !== finding[key]))
        return false;
    if (record.names !== undefined) {
        if (finding.name === undefined) return false;
        if (!record.names.includes(finding.name)) return false;
    }
    return record.paths === undefined || record.paths.length === 0 || buildPathMatcher(record.paths)(finding.file);
}

// Rereads the repository after fixers changed it, so the next run checks the corrected files.
async function refreshAfterFixes(session: Session): Promise<void> {
    session.reads = createReadCache(session.root);
    session.repository = await readSessionRepository({
        settings: session.settingsFile.settings,
        text: session.settingsFile.text,
        configurations: session.configurations,
        reads: session.reads,
    });
    session.inspections.clear();
}

// The result of a check that cannot run: canceled or without Docker.
function findUnrunnableResult(session: Session, planned: PlannedCheck, base: CheckResult): CheckResult | undefined {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: 'The check was canceled.' };
    if (planned.check.needs?.includes('docker') !== true) return undefined;
    return 'status' in findTool(session, session.root, getTool(session.configurations.values(), DOCKER_TOOL))
        ? { ...base, status: 'missing', note: DOCKER_MISSING_MESSAGE }
        : undefined;
}

function classifyCheckError(name: string, error: unknown): Pick<CheckResult, 'status' | 'note' | 'cause'> {
    if (error instanceof GspotError && error.code === 'skip')
        return { status: 'skipped', cause: 'condition', note: error.message };
    if (error instanceof GspotError && error.code === 'tool') return { status: 'missing', note: error.message };
    return {
        status: 'error',
        note: `The ${name} check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
}

async function runPlannedCheck(runState: RunState, planned: PlannedCheck): Promise<CheckResult> {
    const { session } = runState;
    const base = buildBaseResult(planned, session);
    const early = findUnrunnableResult(session, planned, base);
    if (early) return early;
    const started = performance.now();
    // Each thrown failure belongs to this check; the other results of the run survive.
    try {
        return await runCheckCode(session, planned, findCheckCode(planned.check));
    } catch (error) {
        return { ...base, duration: performance.now() - started, ...classifyCheckError(planned.check.name, error) };
    }
}

function removeIgnoredFindings(result: CheckResult, ignores: IgnoreRecord[]): void {
    result.findings = result.findings.filter((finding) => !ignores.some((record) => isIgnoreMatch(record, finding)));
    result.status = result.findings.length > 0 ? 'failed' : 'passed';
}

// A project-wide check reads the whole project. Path arguments drop its findings in the other tracked files. Findings
// without a file stay, and so do findings in an untracked file, such as the build output that a site check reads.
function removeOutsideFindings(result: CheckResult, runState: RunState): void {
    const { options, session } = runState;
    if (options.paths === undefined || options.staged !== undefined) return;
    const paths = new Set(options.paths);
    const tracked = new Set(session.repository.files.map((file) => file.path));
    result.findings = result.findings.filter((finding) => paths.has(finding.file) || !tracked.has(finding.file));
}

function finishResult(runState: RunState, result: CheckResult): void {
    if (RAN_STATUSES.has(result.status)) {
        removeOutsideFindings(result, runState);
        removeIgnoredFindings(result, runState.session.settingsFile.settings.ignore);
    }
    if (FAILED_STATUSES.has(result.status))
        result.reproduce = formatReproduceCommand(result.check, result.scope, {
            messageFile: runState.options.messageFile,
            push: runState.options.push,
            staged: runState.options.comparison?.content === 'index',
        });
}

async function runActiveChecks(runState: RunState, checks: PlannedCheck[]): Promise<CheckResult[]> {
    const limiter = pLimit(availableParallelism());
    let completed = 0;
    // runPlannedCheck catches check errors; these rejections cover ignore matching and onProgress callbacks before resource disposal.
    const settled = await Promise.allSettled(
        checks.map((planned) =>
            limiter(async () => {
                const result = await runPlannedCheck(runState, planned);
                finishResult(runState, result);
                runState.options.onProgress?.({
                    completed: ++completed,
                    total: checks.length,
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
    const planned = planChecks(session, options);
    if (!options.fix) return { planned, fixes: undefined };
    const fixes = await runFixers(session, planned, {
        isDryRun: options.isDryRun,
    });
    if (options.isDryRun) return { planned, fixes };
    await refreshAfterFixes(session);
    return { planned: planChecks(session, options), fixes };
}

/**
 * Runs the checks and returns the report.
 *
 * @param opened the repository and its tools.
 * @param options stage, skips, and fix flags.
 * @returns the report, the plan, and the fix report when --fix ran.
 */
export async function runChecks(opened: Session, options: RunOptions): Promise<RunResult> {
    const session = opened;
    const started = new Date();
    const { planned, fixes } = await planAfterFixes(session, options);
    const runState: RunState = {
        session,
        options,
    };
    const active = planned.filter((check) => isActive(check) && check.skip === undefined);
    const ran = await runActiveChecks(runState, active);
    const report = buildRunReport({
        session,
        options,
        started,
        planned,
        active,
        ran,
        ignores: session.settingsFile.settings.ignore,
        fixes,
    });
    return fixes ? { report, planned, fixes } : { report, planned };
}

/**
 * Run a built-in check or the command of its implementation.
 *
 * @param session the repository and its tools.
 * @param planned the check to run.
 * @param implementation the check implementation, or undefined for a tool command.
 * @param options the command and temporary folder overrides.
 * @returns the check result.
 */
export async function runCheckCode(
    session: Session,
    planned: PlannedCheck,
    implementation: CheckCode | undefined,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    if (implementation?.check !== undefined) return runBuiltInCheck(implementation.check, session, planned);
    return (implementation?.run ?? runCheckCommand)(session, planned, {
        ...options,
        listFileArguments: implementation?.listFileArguments,
        listToolFiles: implementation?.listToolFiles,
    });
}
