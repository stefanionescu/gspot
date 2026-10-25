import pLimit from 'p-limit';
import { join, relative } from 'node:path';
import { availableParallelism } from 'node:os';
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { buildBaseResult } from '#cli/runs/report.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { readSessionRepository } from '#cli/session.ts';
import { readToolBinPaths } from '#cli/tools/locate.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { FixReport } from '#cli/types/runs/fixes.ts';
import { DOCKER_TOOL } from '#cli/config/tools/inspect.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { listRepositoryFiles } from '#cli/repository/read.ts';
import { isActive, planChecks } from '#cli/planning/checks.ts';
import type { IgnoreRecord } from '#cli/types/settings/file.ts';
import { INCOMPLETE_STATUSES } from '#cli/config/runs/report.ts';
import { readToolAvailability } from '#cli/runs/command/tool.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { EXIT_ERROR, EXIT_FINDINGS } from '#cli/config/terminal.ts';
import { SHORT_HASH_LENGTH } from '#cli/config/commands/check/check.ts';
import { RAN_STATUSES, FAILED_STATUSES } from '#cli/config/runs/check.ts';
import { DOCKER_MISSING_MESSAGE } from '#cli/config/commands/check/run.ts';
import type { FinishedRun, ReproduceOptions } from '#cli/types/commands/check.ts';
import type { Run, RunResult, RunReport, RunOptions, PlanAfterFixes } from '#cli/types/runs/run.ts';
import type { Finding, CheckCode, CheckResult, BuiltInCheck, CheckRunOptions } from '#cli/types/runs/check.ts';

function isIgnoreMatch(record: IgnoreRecord, finding: Finding): boolean {
    if ((['check', 'rule'] as const).some((key) => record[key] !== undefined && record[key] !== finding[key]))
        return false;
    return (
        (record.names === undefined || (finding.name !== undefined && record.names.includes(finding.name))) &&
        (record.paths === undefined || record.paths.length === 0 || buildPathMatcher(record.paths)(finding.file))
    );
}

async function readSessionAfterFixes(session: CheckSession): Promise<CheckSession> {
    const reads = createReadCache(session.root);
    const repository = await readSessionRepository({
        settings: session.settingsFile.settings,
        configurations: session.configurations,
        reads,
        listing: await listRepositoryFiles(reads),
    });
    return { ...session, reads, repository, inspections: new Map() };
}

function findUnrunnableResult(
    session: CheckSession,
    planned: PlannedCheck,
    base: CheckResult,
): CheckResult | undefined {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: 'The check was canceled.' };
    if (planned.check.needs?.includes('docker') !== true) return undefined;
    return 'status' in
        readToolAvailability(session, session.root, getTool(session.configurations.values(), DOCKER_TOOL))
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

async function runPlannedCheck(run: Run, planned: PlannedCheck): Promise<CheckResult> {
    const { session } = run;
    const base = buildBaseResult(planned, session);
    const unrunnable = findUnrunnableResult(session, planned, base);
    if (unrunnable) return unrunnable;
    const started = performance.now();
    try {
        return await runCheckCode(session, planned, findCheckCode(planned.check), { verbose: run.options.verbose });
    } catch (error) {
        return {
            ...base,
            duration: Math.round(performance.now() - started),
            ...classifyCheckError(planned.check.id, error),
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

function formatReproduceCommand(checkId: string, scopeArgument: string | undefined, options: ReproduceOptions): string {
    const { paths, changed, messageFile, staged } = options;
    const words = ['gspot check'];
    if (paths.length > 0) words.push(...paths.map((path) => quoteArgument(path)));
    else if (scopeArgument !== undefined && messageFile === undefined) words.push(quoteArgument(scopeArgument));
    words.push('--only', quoteArgument(checkId));
    if (changed !== undefined) words.push('--changed', quoteArgument(changed));
    if (messageFile !== undefined) words.push('--hook', 'commit-msg', '--', quoteArgument(messageFile));
    if (staged) words.push('--staged');
    return words.join(' ');
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

async function planAfterFixes(session: CheckSession, options: RunOptions): Promise<PlanAfterFixes> {
    const planned = planChecks(session, options);
    if (!options.fix) return { session, planned, fixes: undefined };
    const fixes = await runFixers(session, planned, {
        isDryRun: options.isDryRun,
    });
    if (options.isDryRun) return { session, planned, fixes };
    const fixed = await readSessionAfterFixes(session);
    return { session: fixed, planned: planChecks(fixed, options), fixes };
}

function listFailedChecks(results: CheckResult[], fixes: FixReport | undefined): string[] {
    const checks = results.filter((result) => FAILED_STATUSES.has(result.status)).map((result) => result.check);
    const failedFixers = (fixes?.results ?? []).flatMap((result) => (result.status === 'failed' ? [result.check] : []));
    return [...new Set([...checks, ...failedFixers])];
}

function isIncomplete(session: Session, results: CheckResult[], fixes: FixReport | undefined): boolean {
    return (
        session.cancelSignal?.aborted === true ||
        results.some((result) => INCOMPLETE_STATUSES.has(result.status)) ||
        fixes?.results.some((result) => result.status === 'failed') === true
    );
}

function buildRunReport(run: FinishedRun): RunReport {
    const { session, options, started, planned, ran, fixes } = run;
    const results = new Map(run.active.map((check, index) => [check, ran[index] as CheckResult]));
    const checks = planned.map<CheckResult>(
        (check) =>
            results.get(check) ?? {
                ...buildBaseResult(check, session),
                status: 'skipped' as const,
                cause: check.skip?.cause ?? 'no-files',
                note: check.skip?.note ?? 'No matching files.',
            },
    );
    const failed = listFailedChecks(checks, fixes);
    let code = failed.length > 0 ? EXIT_FINDINGS : 0;
    if (isIncomplete(session, ran, fixes)) code = EXIT_ERROR;
    if (session.cancelSignal?.aborted === true && typeof session.cancelSignal.reason === 'number')
        code = session.cancelSignal.reason;
    return {
        ...(options.comparison !== undefined && { comparison: options.comparison }),
        version: cliPackage.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks,
        ignores: session.settingsFile.settings.ignore.map(({ until, ...record }) =>
            stripUndefined({ ...record, until: until?.toISOString() }),
        ),
        unstagedChanges: options.unstagedChanges ?? 0,
        partial: [options.staged, options.changed, options.paths].some((selection) => selection !== undefined),
        failed,
        exitCode: code,
    };
}

/**
Plan and run the checks, after the fixers when --fix asks, then drop ignored findings and build the run report.

@param session the repository and its tools.
@param options the stage, the file selection, and the fix flags.
@returns the report, the plan, and the fix report when --fix ran.
*/
export async function runChecks(session: Session, options: RunOptions): Promise<RunResult> {
    const started = new Date();
    const { session: checked, planned, fixes } = await planAfterFixes(buildCheckSession(session), options);
    const active = planned.filter((check) => isActive(check) && check.skip === undefined);
    const ran = await runActiveChecks({ session: checked, options }, active);
    const report = buildRunReport({
        session: checked,
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
Give a session the reader of the program folders of its mise tools, which asks mise once, when a check first needs a
tool.

@param session the repository and its tools.
@returns the session that the checks of one run share.
*/
export function buildCheckSession(session: Session): CheckSession {
    let miseBinPaths: string[] | undefined;
    return {
        ...session,
        readMiseBinPaths: () => {
            miseBinPaths ??= readToolBinPaths(session);
            return miseBinPaths;
        },
    };
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
    session: CheckSession,
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

async function runBuiltInCheck(
    builtInCheck: BuiltInCheck,
    session: CheckSession,
    planned: PlannedCheck,
): Promise<CheckResult> {
    const started = performance.now();
    const result = await builtInCheck(session, planned);
    const findings = Array.isArray(result) ? result : result.findings;
    const files = Array.isArray(result) ? undefined : [...new Set(result.files)];
    for (const finding of findings) finding.help ??= planned.check.help;
    return {
        ...buildBaseResult(planned, session),
        findings,
        ...(files !== undefined && { files, fileCount: files.length }),
        status: findings.length > 0 ? 'failed' : 'passed',
        duration: Math.round(performance.now() - started),
    };
}
