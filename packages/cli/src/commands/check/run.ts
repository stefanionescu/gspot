import pLimit from 'p-limit';
import { join, relative } from 'node:path';
import { availableParallelism } from 'node:os';
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { openSession } from '#cli/planning/session.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { readToolBinPaths } from '#cli/tools/locate.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { DOCKER_TOOL } from '#cli/config/tools/inspect.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { getCachedValue } from '#cli/system/files/cache.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import { isActive, planChecks } from '#cli/planning/checks.ts';
import { type IgnoreRecord } from '#cli/types/settings/file.ts';
import { INCOMPLETE_STATUSES } from '#cli/config/runs/results.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { EXIT_ERROR, EXIT_FINDINGS } from '#cli/config/terminal.ts';
import { SHORT_HASH_LENGTH } from '#cli/config/commands/check/check.ts';
import { type Session, type CheckSession } from '#cli/types/session.ts';
import { checkGeneratorOutputs } from '#cli/checks/generator-outputs.ts';
import { listDetectedAdditions } from '#cli/repository/configurations.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { STAGED_FLAG, CHANGED_FLAG } from '#cli/config/commands/check/flags.ts';
import { buildBaseResult, runBuiltInCheck, normalizeResultPaths } from '#cli/runs/results.ts';
import { type Finding, type CheckCode, type CheckResult, type CheckRunOptions } from '#cli/types/runs/check.ts';

import {
    HOOK_FLAG,
    CHECK_COMMAND,
    FAILED_STATUSES,
    NO_FILES_MESSAGE,
    CANCELED_CHECK_NOTE,
    DOCKER_MISSING_MESSAGE,
} from '#cli/config/commands/check/run.ts';
import {
    type Run,
    type FixReport,
    type RunResult,
    type RunReport,
    type RunOptions,
    type FinishedRun,
    type PlanAfterFixes,
    type ReproduceOptions,
} from '#cli/types/commands/check.ts';

function isIgnoreMatch(record: IgnoreRecord, finding: Finding): boolean {
    if ((['check', 'rule'] as const).some((key) => record[key] !== undefined && record[key] !== finding[key]))
        return false;
    return (
        (record.names === undefined || (finding.name !== undefined && record.names.includes(finding.name))) &&
        (record.paths === undefined || record.paths.length === 0 || buildPathMatcher(record.paths)(finding.file))
    );
}

const DOCKER_AVAILABILITY = { create: () => new Map<string, Promise<SpawnResult>>() };

async function findUnrunnableResult(
    session: CheckSession,
    planned: PlannedCheck,
    base: CheckResult,
): Promise<CheckResult | undefined> {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: CANCELED_CHECK_NOTE };
    if (planned.check.needs?.includes('docker') !== true) return undefined;
    if (
        'status' in
        buildToolAvailability(
            getTool(session.configurationsByName.values(), DOCKER_TOOL),
            inspectTool(
                { ...session, cwd: session.root, miseBinPaths: session.readMiseBinPaths() },
                getTool(session.configurationsByName.values(), DOCKER_TOOL),
            ),
        )
    )
        return { ...base, status: 'missing', note: DOCKER_MISSING_MESSAGE };
    const available = getCachedValue(session.reads, DOCKER_AVAILABILITY);
    let pending = available.get(session.root);
    if (pending === undefined) {
        pending = spawnProcess([DOCKER_TOOL, 'info'], {
            cwd: session.root,
            timeoutSeconds: session.timeoutSeconds,
            cancelSignal: session.cancelSignal,
        });
        available.set(session.root, pending);
    }
    const result = await pending;
    return result.code === 0
        ? undefined
        : { ...base, status: 'missing', note: 'Start Docker, then run the check again.' };
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
    const unrunnable = await findUnrunnableResult(session, planned, base);
    if (unrunnable) return unrunnable;
    const started = performance.now();
    try {
        return await runCheckCode(
            session,
            planned,
            planned.check.generator_outputs === undefined
                ? CHECK_CODE[planned.check.id]
                : { check: checkGeneratorOutputs },
            { verbose: run.options.verbose },
        );
    } catch (error) {
        return {
            ...base,
            duration: Math.round(performance.now() - started),
            ...(session.cancelSignal?.aborted === true
                ? { status: 'error', note: CANCELED_CHECK_NOTE }
                : classifyCheckError(planned.check.id, error)),
        };
    }
}

function removeIgnoredFindings(result: CheckResult, ignores: IgnoreRecord[]): void {
    result.findings = result.findings.filter((finding) => ignores.every((record) => !isIgnoreMatch(record, finding)));
    if (result.status === 'passed' || result.status === 'failed')
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
    const words = [CHECK_COMMAND];
    if (paths.length > 0) words.push(...paths.map((path) => quoteArgument(path.startsWith('-') ? `./${path}` : path)));
    else if (scopeArgument !== undefined && messageFile === undefined)
        words.push(quoteArgument(scopeArgument.startsWith('-') ? `./${scopeArgument}` : scopeArgument));
    words.push('--only', quoteArgument(checkId));
    if (changed !== undefined) words.push(CHANGED_FLAG, quoteArgument(changed));
    if (messageFile !== undefined) words.push(HOOK_FLAG, 'commit-msg', '--', quoteArgument(messageFile));
    if (staged) words.push(STAGED_FLAG);
    return words.join(' ');
}

function finishResult(run: Run, result: CheckResult): void {
    removeOutsideFindings(result, run);
    removeIgnoredFindings(result, run.session.settings.ignore);
    normalizeResultPaths(run.session, result);
    if (!FAILED_STATUSES.has(result.status) || run.session.cancelSignal?.aborted === true) return;
    const scopeArgument =
        result.scope === ''
            ? undefined
            : convertToPosixPath(relative(run.options.cwd, join(run.session.toolsRoot, result.scope))) || '.';
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
        dryRun: options.dryRun,
    });
    if (options.dryRun) return { session, planned, fixes };
    const fixed = buildCheckSession(
        await openSession(session.root, {
            toolsRoot: session.toolsRoot,
            resources: session.resources,
            cancelSignal: session.cancelSignal,
        }),
    );
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
        (fixes !== undefined && fixes.broken.length > 0) ||
        fixes?.results.some((result) => result.status === 'failed') === true
    );
}

function buildRunReport(run: FinishedRun): RunReport {
    const { session, options, started, planned, results: ran, fixes } = run;
    const results = new Map(run.active.map((check, index) => [check, ran[index] as CheckResult]));
    const checks = planned.map<CheckResult>(
        (check) =>
            results.get(check) ?? {
                ...buildBaseResult(check, session),
                status: 'skipped' as const,
                cause: check.skip?.cause ?? 'no-files',
                note: check.skip?.note ?? NO_FILES_MESSAGE,
            },
    );
    const failed = listFailedChecks(checks, fixes);
    let code = failed.length > 0 ? EXIT_FINDINGS : 0;
    if (isIncomplete(session, ran, fixes)) code = EXIT_ERROR;
    if (session.cancelSignal?.aborted === true && typeof session.cancelSignal.reason === 'number')
        code = session.cancelSignal.reason;
    return {
        ...(options.comparison !== undefined && { comparison: options.comparison }),
        notes: listDetectedAdditions(session).map(
            ({ scope, configurations }) =>
                `Detected ${configurations.join(', ')}${scope === '.' || scope === '' ? '' : ' in ' + scope}. Run gspot add to enable the new configurations.`,
        ),
        version: cliPackage.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks,
        ignores: session.settings.ignore.map(({ until, ...record }) =>
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
        results: ran,
        fixes,
    });
    return fixes ? { report, planned, fixes } : { report, planned };
}

/**
Give a session the reader of the program folders of its mise tools, which asks mise once, when a check first needs a
tool.

@param session the repository and its tools.
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
*/
export async function runCheckCode(
    session: CheckSession,
    planned: PlannedCheck,
    code: CheckCode | undefined,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    if (code?.check !== undefined) return runBuiltInCheck(code.check, session, planned);
    return (code?.run ?? runCommandCheck)(session, planned, {
        ...options,
        listFileArguments: code?.listFileArguments,
        listConfigFiles: code?.listConfigFiles,
    });
}
