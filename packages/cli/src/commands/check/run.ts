import pLimit from 'p-limit';
import { join, relative } from 'node:path';
import { availableParallelism } from 'node:os';
import { GspotError } from '#cli/system/errors.ts';
import { findTool } from '#cli/runs/command/tool.ts';
import type { Session } from '#cli/types/session.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { runBuiltInCheck } from '#cli/runs/built-in.ts';
import { readSessionRepository } from '#cli/session.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { DOCKER_TOOL } from '#cli/config/tools/inspect.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { SHORT_HASH_LENGTH } from '#cli/config/runs/report.ts';
import { isActive, planChecks } from '#cli/planning/checks.ts';
import type { IgnoreRecord } from '#cli/types/settings/file.ts';
import type { ReproduceOptions } from '#cli/types/runs/report.ts';
import { RAN_STATUSES, FAILED_STATUSES } from '#cli/config/runs/check.ts';
import { DOCKER_MISSING_MESSAGE } from '#cli/config/commands/check/run.ts';
import type { Run, RunResult, RunOptions, PlanAfterFixes } from '#cli/types/runs/run.ts';
import { buildRunReport, buildBaseResult, formatReproduceCommand } from '#cli/runs/report.ts';
import type { Finding, CheckCode, CheckResult, CheckRunOptions } from '#cli/types/runs/check.ts';

function isIgnoreMatch(record: IgnoreRecord, finding: Finding): boolean {
    if ((['check', 'rule'] as const).some((key) => record[key] !== undefined && record[key] !== finding[key]))
        return false;
    return (
        (record.names === undefined || (finding.name !== undefined && record.names.includes(finding.name))) &&
        (record.paths === undefined || record.paths.length === 0 || buildPathMatcher(record.paths)(finding.file))
    );
}

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

async function runPlannedCheck(run: Run, runnable: PlannedCheck): Promise<CheckResult> {
    const { session } = run;
    const base = buildBaseResult(runnable, session);
    const early = findUnrunnableResult(session, runnable, base);
    if (early) return early;
    const started = performance.now();
    try {
        return await runCheckCode(session, runnable, findCheckCode(runnable.check), { verbose: run.options.verbose });
    } catch (error) {
        return {
            ...base,
            duration: Math.round(performance.now() - started),
            ...classifyCheckError(runnable.check.id, error),
        };
    }
}

function removeIgnoredFindings(result: CheckResult, ignores: IgnoreRecord[]): void {
    result.findings = result.findings.filter((finding) => ignores.every((record) => !isIgnoreMatch(record, finding)));
    result.status = result.findings.length > 0 ? 'failed' : 'passed';
}

function removeOutsideFindings(result: CheckResult, run: Run): void {
    const { options, session } = run;
    if (options.paths === undefined) return;
    const paths = new Set(options.paths);
    const tracked = new Set(session.repository.files.map((file) => file.path));
    result.findings = result.findings.filter((finding) => paths.has(finding.file) || !tracked.has(finding.file));
}

function buildReproduceOptions(options: RunOptions): ReproduceOptions {
    const comparison = options.comparison;
    let changed: string | undefined;
    if (comparison?.content === 'working-tree') changed = comparison.reference;
    else if (comparison?.content === 'commit') changed = options.base?.slice(0, SHORT_HASH_LENGTH);
    return {
        paths: options.pathArguments,
        changed,
        messageFile: options.messageFile,
        staged: comparison?.content === 'index',
    };
}

function finishResult(run: Run, result: CheckResult): void {
    if (RAN_STATUSES.has(result.status)) {
        removeOutsideFindings(result, run);
        removeIgnoredFindings(result, run.session.settingsFile.settings.ignore);
    }
    if (!FAILED_STATUSES.has(result.status)) return;
    const scopeArgument =
        result.scope === ''
            ? undefined
            : convertToPosixPath(relative(run.options.cwd, join(run.session.installedRoot, result.scope))) || '.';
    result.reproduce = formatReproduceCommand(result.check, scopeArgument, buildReproduceOptions(run.options));
}

async function runActiveChecks(run: Run, checks: PlannedCheck[]): Promise<CheckResult[]> {
    const limiter = pLimit(availableParallelism());
    let finished = 0;
    const settled = await Promise.allSettled(
        checks.map((planned) =>
            limiter(async () => {
                const result = await runPlannedCheck(run, planned);
                finishResult(run, result);
                run.options.onProgress?.({
                    finished: ++finished,
                    total: checks.length,
                    comparison: run.options.comparison,
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
Plan and run the checks, after the fixers when --fix asks, then drop ignored findings and build the run report.

@param session the repository and its tools.
@param options the stage, the file selection, and the fix flags.
@returns the report, the plan, and the fix report when --fix ran.
*/
export async function runChecks(session: Session, options: RunOptions): Promise<RunResult> {
    const started = new Date();
    const { planned, fixes } = await planAfterFixes(session, options);
    const runState: Run = {
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
        fixes,
    });
    return fixes ? { report, planned, fixes } : { report, planned };
}

/**
Run a built-in check or the command of its implementation.

@param session the repository and its tools.
@param planned the check to run.
@param code the check implementation, or undefined for a tool command.
@param options the command and temporary folder overrides.
@returns the check result.
*/
export async function runCheckCode(
    session: Session,
    planned: PlannedCheck,
    code: CheckCode | undefined,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    if (code?.check !== undefined) return runBuiltInCheck(code.check, session, planned);
    return (code?.run ?? runCheckCommand)(session, planned, {
        ...options,
        listFileArguments: code?.listFileArguments,
        listConfigFiles: code?.listConfigFiles,
    });
}
