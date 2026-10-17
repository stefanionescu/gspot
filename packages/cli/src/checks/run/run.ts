import pLimit from 'p-limit';
import { availableParallelism } from 'node:os';
import { GspotError } from '#cli/system/errors.ts';
import { runFixers } from '#cli/checks/run/fixes.ts';
import { readRepository } from '#cli/repository/read.ts';
import { findTool } from '#cli/checks/run/command/tool.ts';
import { planRun, isActive } from '#cli/planning/checks.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { runBuiltInCheck } from '#cli/checks/run/built-in.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listActiveIgnores } from '#cli/settings/scope-view.ts';
import type { IgnoreRecord } from '#cli/types/settings/file.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { runCheckCommand } from '#cli/checks/run/command/check.ts';
import { listFileDeclarations } from '#cli/repository/classify.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { DOCKER_TOOL } from '#cli/config/checks/infrastructure/docker.ts';
import { checkStaleGeneratorOutputs } from '#cli/checks/stale-generator-outputs.ts';
import { buildRunReport, buildBaseResult, formatReproduceCommand } from '#cli/checks/run/report.ts';
import { RAN_STATUSES, FAILED_STATUSES, DOCKER_MISSING_MESSAGE } from '#cli/config/checks/run/run.ts';

import {
    type Finding,
    type RunState,
    type IgnoreUse,
    type RunResult,
    type RunOptions,
    type CheckResult,
    type RunnableCheck,
    type PlanAfterFixes,
    type CheckImplementations,
} from '#cli/types/checks/run/check.ts';

/**
 * Checks whether an ignore record covers a finding.
 * @param entry the `[[ignore]]` record.
 * @param finding what a check reported.
 * @returns whether the ignore covers this finding.
 */
function isEntryMatch(entry: IgnoreRecord, finding: Finding): boolean {
    if (entry.check !== finding.check) return false;
    if (entry.rule !== undefined && entry.rule !== finding.rule) return false;
    return entry.paths === undefined || entry.paths.length === 0 || buildPathMatcher(entry.paths)(finding.file);
}

function planChecks(session: Session, options: RunOptions): RunnableCheck[] {
    const planned = planRun(session, options);
    const implementations: CheckImplementations = CHECK_IMPLEMENTATIONS;
    return planned.map((check) => {
        const builtIn = implementations[check.check.name];
        return {
            check,
            run: selectCheckRun(check.check),
            arguments: builtIn?.arguments,
            toolFiles: builtIn?.toolFiles,
        };
    });
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
    session.dependencyFiles = session.repository.dependencyFiles;
    session.inspections.clear();
}

// The result of a check that cannot run: canceled, skipped by the plan, or without Docker.
function findUnrunnableResult(session: Session, planned: PlannedCheck, base: CheckResult): CheckResult | undefined {
    if (session.cancelSignal?.aborted === true) return { ...base, status: 'error', note: 'The check was canceled.' };
    if (planned.skip) return { ...base, status: 'skipped', note: planned.skip.note };
    const preconditions = {
        build: undefined,
        network: undefined,
        docker: () =>
            'status' in findTool(session, session.root, getToolDeclaration(session.manifests.values(), DOCKER_TOOL))
                ? { ...base, status: 'missing' as const, note: DOCKER_MISSING_MESSAGE }
                : undefined,
    };
    return planned.check.needs?.map((need) => preconditions[need]?.()).find((result) => result !== undefined);
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
        return await run(session, planned, {
            arguments: executable.arguments,
            toolFiles: executable.toolFiles,
            ...(staged === undefined ? {} : { staged }),
        });
    } catch (error) {
        return { ...base, duration: performance.now() - started, ...checkFailure(planned.check.name, error) };
    }
}

function dropIgnoredFindings(check: PlannedCheck, result: CheckResult, uses: Map<IgnoreRecord, IgnoreUse>): void {
    result.findings = result.findings.filter((finding) => {
        const use = uses.values().find(({ entry }) => entry.check === check.check.name && isEntryMatch(entry, finding));
        if (use === undefined) return true;
        use.matched += 1;
        return false;
    });
    result.status = result.findings.length > 0 ? 'failed' : 'passed';
}

function filterResult(runState: RunState, check: PlannedCheck, result: CheckResult): void {
    if (RAN_STATUSES.has(result.status)) dropIgnoredFindings(check, result, runState.uses);
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
                filterResult(runState, executable.check, result);
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
        { isDryRun: options.isDryRun },
    );
    if (options.isDryRun) return { executables, fixes };
    await refreshAfterFixes(session);
    return { executables: planChecks(session, options), fixes };
}

/**
 * Pick the code that runs one check: the stale-output check, a built-in implementation, its own runner, or the tool
 * command.
 * @param check the check to run.
 * @returns the run function.
 */
export function selectCheckRun(check: CheckDeclaration): RunnableCheck['run'] {
    if (check.generator_outputs !== undefined) return runBuiltInCheck(checkStaleGeneratorOutputs);
    const builtIn = (CHECK_IMPLEMENTATIONS as CheckImplementations)[check.name];
    if (builtIn?.check !== undefined) return runBuiltInCheck(builtIn.check);
    return builtIn?.run ?? runCheckCommand;
}

/**
 * Runs the checks and returns the report.
 * @param opened the repository and its tools.
 * @param options stage, skips, and fix flags.
 * @returns the report, the plan, and the fix report when --fix ran.
 */
export async function runChecks(opened: Session, options: RunOptions): Promise<RunResult> {
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
        uses: new Map(ignore.map((entry) => [entry, { entry, matched: 0 }])),
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
