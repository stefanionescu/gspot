import cliPackage from '#cli-package' with { type: 'json' };
import {
    EXIT_FINDINGS,
    FAILED_STATUSES,
    INCOMPLETE_STATUSES,
    NO_FILES_MESSAGE,
    PROGRESS_INTERVAL_MILLISECONDS,
    REPORT_STAGES,
    SHORT_HASH_LENGTH,
    STAGED_FILES,
    WORKING_TREE,
} from '#cli/config/engine.ts';
import { EXIT_ERROR } from '#cli/config/system.ts';
import { buildBaseResult, formatExplainCommand } from '#cli/engine/results.ts';
import { listUnparsedDependencyFiles } from '#cli/repository/dependencies.ts';
import { rewriteProgress, writeProgress } from '#cli/system/terminal.ts';
import { formatNameList, formatScopePrefix, formatSeconds } from '#cli/system/text.ts';
import type {
    CheckProgress,
    CheckResult,
    FinishedRun,
    FixReport,
    RunOptions,
    RunReport,
} from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

const RUNNING_CHECKS_SHOWN = 3;

function formatRunningChecks(running: Array<Pick<CheckResult, 'check' | 'scope'>>): string {
    const names = running
        .slice(0, RUNNING_CHECKS_SHOWN)
        .map(({ check, scope }) => `${formatScopePrefix(scope)}${check}`);
    const hidden = running.length - names.length;
    return formatNameList(hidden > 0 ? [...names, `${String(hidden)} more`] : names);
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

function addFindingExplanations(
    result: CheckResult,
    { help, selectCheckCode }: { help: string; selectCheckCode: RunOptions['selectCheckCode'] },
): CheckResult {
    const findings = result.findings.map(({ help: own, ...finding }) => ({
        ...finding,
        explain: formatExplainCommand(finding, selectCheckCode),
        ...(own !== undefined && own !== help && { help: own }),
    }));
    return { ...result, ...(findings.length > 0 && { help }), findings };
}

export function buildEmptyRunReport(stage: RunOptions['stage'], started: Date, notes: string[]): RunReport {
    const stages = REPORT_STAGES[stage];
    const duration = Date.now() - started.getTime();
    return {
        version: cliPackage.version,
        notes,
        comparison: null,
        fixes: null,
        stages,
        started: started.toISOString(),
        duration,
        checks: [],
        skippedCount: {},
        ignores: [],
        unstagedChanges: 0,
        partial: true,
        failed: [],
        exitCode: 0,
    };
}

export function buildRunReport(run: FinishedRun): RunReport {
    const { session, options, comparison, started, planned, results: ran, fixes } = run;
    const results = new Map(run.active.map((check, index) => [check, ran[index] as CheckResult]));
    const checks = planned.map((check) =>
        addFindingExplanations(
            results.get(check) ?? {
                ...buildBaseResult(check, session),
                status: 'skipped',
                cause: check.skip?.cause ?? 'no-files',
                note: check.skip?.note ?? NO_FILES_MESSAGE,
            },
            { help: check.check.help, selectCheckCode: options.selectCheckCode },
        ),
    );
    const ranChecks = new Set(checks.filter(({ status }) => status !== 'skipped').map(({ check }) => check));
    const skipped = Map.groupBy(
        new Map(
            checks
                .filter(({ check, status }) => status === 'skipped' && !ranChecks.has(check))
                .map((row) => [row.check, row]),
        ).values(),
        ({ cause = 'no-files' }) => cause,
    );
    const failed = listFailedChecks(checks, fixes);
    let code = failed.length > 0 ? EXIT_FINDINGS : 0;
    if (isIncomplete(session, ran, fixes)) code = EXIT_ERROR;
    const notes = [
        ...listUnparsedDependencyFiles(session.repository.files, session.repository.dependencyFiles).map(
            (path) => `${path} does not parse, so gspot read no dependencies from it.`,
        ),
        ...checks.flatMap(({ reportNotes }) => reportNotes ?? []),
    ];
    return {
        ...buildEmptyRunReport(options.stage, started, notes),
        comparison,
        fixes: fixes ?? null,
        checks: checks
            .filter(({ cause }) => options.verbose === true || cause !== 'no-files')
            .map(({ reportNotes: _notes, span: _span, command, ...check }) => ({
                ...check,
                ...(options.verbose === true && command !== undefined && { command }),
            })),
        skippedCount: Object.fromEntries([...skipped].map(([cause, group]) => [cause, group.length])),
        ignores: session.settings.ignore,
        unstagedChanges: options.selection?.unstagedChanges ?? 0,
        partial: options.selection?.paths !== undefined || options.paths !== undefined,
        failed,
        exitCode: code,
    };
}

export function formatCheckedContent(comparison: CheckProgress['comparison']): string {
    if (comparison?.content === 'index') return STAGED_FILES;
    return comparison?.content === 'commit'
        ? `commit ${comparison.reference.slice(0, SHORT_HASH_LENGTH)}`
        : WORKING_TREE;
}

/**
Rewrite the progress line when stderr takes one. Otherwise print a line only for the checks that run past the progress
interval: the checks still running at each interval, and a check that finishes after it.
*/
export function printProgress(progress: CheckProgress): void {
    const subject = formatCheckedContent(progress.comparison);
    if (rewriteProgress(`Checking ${subject}: ${String(progress.finished)} of ${String(progress.total)} checks done`))
        return;
    if (progress.kind === 'running') {
        if (progress.running.length > 0)
            writeProgress(`running  ${formatRunningChecks(progress.running)}  ${formatSeconds(progress.elapsed)}\n`);
        return;
    }
    if (progress.duration < PROGRESS_INTERVAL_MILLISECONDS) return;
    writeProgress(`done  ${formatScopePrefix(progress.scope)}${progress.check}  ${formatSeconds(progress.duration)}\n`);
}
