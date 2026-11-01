import pLimit from 'p-limit';
import { join, relative } from 'node:path';
import { getTool } from '#cli/tools/pins.ts';
import { availableParallelism } from 'node:os';
import { remember } from '#cli/system/cache.ts';
import { runFixers } from '#cli/engine/fixes.ts';
import type { Session } from '#cli/types/tools.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { openSession } from '#cli/engine/session.ts';
import { findToolPath } from '#cli/tools/inspect.ts';
import { buildRunReport } from '#cli/engine/report.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { findMissingEnvironment } from '#cli/tools/uv.ts';
import { isActive, planChecks } from '#cli/engine/plan.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { IgnoreRecord } from '#cli/types/settings.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { CheckStop, GspotError } from '#cli/system/errors.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import { formatUnexpectedError } from '#cli/system/terminal.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { buildBaseResult, runBuiltInCheck, normalizeResultPaths } from '#cli/engine/results.ts';

import type {
    Run,
    CheckCode,
    RunResult,
    RunOptions,
    CheckResult,
    CheckSession,
    PlanAfterFixes,
    CheckGeneration,
    CheckRunOptions,
    ReproduceOptions,
} from '#cli/types/engine/run.ts';
import {
    HOOK_FLAG,
    BASE_FLAG,
    DOCKER_TOOL,
    STAGED_FLAG,
    CHECK_COMMAND,
    FAILED_STATUSES,
    SHORT_HASH_LENGTH,
    DOCKER_DAEMON_NOTE,
    CANCELED_CHECK_NOTE,
    DOCKER_MISSING_MESSAGE,
} from '#cli/config/engine.ts';

function isIgnoreMatch(record: IgnoreRecord, finding: Finding): boolean {
    if ((['check', 'rule'] as const).some((key) => record[key] !== undefined && record[key] !== finding[key]))
        return false;
    return record.paths === undefined || buildPathMatcher(record.paths)(finding.file);
}

const DOCKER_AVAILABILITY = Symbol('docker availability');

async function findUnrunnableResult(
    session: CheckSession,
    planned: PlannedCheck,
    base: CheckResult,
): Promise<CheckResult | undefined> {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: CANCELED_CHECK_NOTE };
    const environment = findMissingEnvironment(session, planned);
    if (environment !== undefined) return { ...base, ...environment };
    if (planned.check.needs?.includes('docker') !== true) return undefined;
    const docker = await findToolPath(session, getTool(readConfigurations().values(), DOCKER_TOOL), session.root);
    if ('status' in docker) return { ...base, status: 'missing', note: DOCKER_MISSING_MESSAGE };
    const result = await remember(session.cache, DOCKER_AVAILABILITY, session.root, () =>
        spawnProcess([docker.path, 'info'], {
            cwd: session.root,
            timeoutSeconds: session.settings.tool_timeout_seconds,
            cancelSignal: session.cancelSignal,
        }),
    );
    return result.code === 0 ? undefined : { ...base, status: 'missing', note: DOCKER_DAEMON_NOTE };
}

function classifyCheckError(
    name: string,
    error: unknown,
    verbose: boolean,
): Pick<CheckResult, 'status' | 'note' | 'cause' | 'stack'> {
    if (error instanceof CheckStop)
        return { status: error.status, ...(error.status === 'skipped' && { cause: 'condition' }), note: error.message };
    if (error instanceof GspotError) return { status: 'error', note: error.message };
    return {
        status: 'error',
        note: formatUnexpectedError(name),
        ...(verbose && { stack: error instanceof Error ? (error.stack ?? error.message) : String(error) }),
    };
}

async function runPlannedCheck(run: Run, planned: PlannedCheck): Promise<CheckResult> {
    const { session } = run;
    const base = buildBaseResult(planned, session);
    const unrunnable = await findUnrunnableResult(session, planned, base);
    if (unrunnable) return unrunnable;
    const started = performance.now();
    try {
        return await runCheckCode(session, planned, run.options.selectCheckCode(planned.check), {
            verbose: run.options.verbose,
        });
    } catch (error) {
        return {
            ...base,
            duration: Math.round(performance.now() - started),
            ...(session.cancelSignal?.aborted === true
                ? { status: 'error', note: CANCELED_CHECK_NOTE }
                : classifyCheckError(planned.check.id, error, run.options.verbose === true)),
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
    if (changed !== undefined) words.push(BASE_FLAG, quoteArgument(changed));
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
    result.rerun = formatReproduceCommand(result.check, scopeArgument, buildReproduceOptions(run.options));
}

async function runActiveChecks(run: Run, checks: PlannedCheck[]): Promise<CheckResult[]> {
    let finished = 0;
    const settled = await Promise.allSettled(
        checks.map(async (planned) => {
            const result = await runPlannedCheck(run, planned);
            finishResult(run, result);
            run.options.onProgress?.({
                check: result.check,
                scope: result.scope,
                duration: result.duration,
                finished: ++finished,
                total: checks.length,
                comparison: run.options.comparison,
            });
            return result;
        }),
    );
    return settled.map((result) => {
        if (result.status === 'rejected') throw result.reason;
        return result.value;
    });
}

async function planAfterFixes(session: CheckSession, options: RunOptions): Promise<PlanAfterFixes> {
    const planned = planChecks(session, options);
    if (!options.fix) return { session, planned, fixes: undefined };
    const fixes = await runFixers(session, planned);
    const fixed = buildCheckSession(
        await openSession(session.root, {
            toolsRoot: session.toolsRoot,
            toolCache: session.toolCache,
            resources: session.resources,
            cancelSignal: session.cancelSignal,
        }),
        session.generation,
    );
    return { session: fixed, planned: planChecks(fixed, options), fixes };
}

/**
Plan and run the checks, after the fixers when --fix asks, then drop ignored findings and build the run report.

@param session the repository and its tools.
@param options the stage, the file selection, and the fix flags.
@returns the report, the plan, and the fix report when --fix ran.
*/
export async function runChecks(session: Session, options: RunOptions): Promise<RunResult> {
    const started = options.started ?? new Date();
    const {
        session: checked,
        planned,
        fixes,
    } = await planAfterFixes(buildCheckSession(session, options.generation), options);
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
Give a session the generators of its checks, and the one limiter that every tool process of its checks waits for.

@param session the repository and its tools.
@param generation the generators called by checks when they need their output.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: A check run, the session after fixers, and the tests build a check session through it, each with its own process limiter.
export function buildCheckSession(session: Session, generation: CheckGeneration): CheckSession {
    return { ...session, generation, limitProcess: pLimit(availableParallelism()) };
}

/**
Run a built-in check or the command of its implementation.

@param session the repository and its tools.
@param planned the check to run.
@param code the check implementation, or undefined for a tool command.
@param options the command override and the verbosity of the notes.
*/
export async function runCheckCode(
    session: CheckSession,
    planned: PlannedCheck,
    code: CheckCode | undefined,
    options: CheckRunOptions,
): Promise<CheckResult> {
    if (code?.check !== undefined) return runBuiltInCheck(code.check, session, planned, options);
    return (code?.run ?? runCommandCheck)(session, planned, {
        ...options,
        listConfigs: code?.listConfigs,
    });
}
