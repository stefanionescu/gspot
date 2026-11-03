import type { Session } from '#cli/types/tools.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { formatScope, formatNameList } from '#cli/system/text.ts';
import { writeProgress, rewriteProgress } from '#cli/system/terminal.ts';
import { EXIT_ERROR, MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { listUnparsedDependencyFiles } from '#cli/repository/dependencies.ts';
import { buildBaseResult, formatExplainCommand } from '#cli/engine/results.ts';

import type {
    FixReport,
    RunReport,
    RunOptions,
    CheckResult,
    FinishedRun,
    CheckProgress,
} from '#cli/types/engine/run.ts';
import {
    STAGED_FILES,
    WORKING_TREE,
    EXIT_FINDINGS,
    REPORT_STAGES,
    FAILED_STATUSES,
    NO_FILES_MESSAGE,
    SHORT_HASH_LENGTH,
    INCOMPLETE_STATUSES,
    PROGRESS_INTERVAL_MILLISECONDS,
} from '#cli/config/engine.ts';

const RUNNING_CHECKS_SHOWN = 3;

function formatRunningChecks(running: Array<Pick<CheckResult, 'check' | 'scope'>>): string {
    const names = running
        .slice(0, RUNNING_CHECKS_SHOWN)
        .map(({ check, scope }) => (scope === '' ? check : `${formatScope(scope)}  ${check}`));
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

function addFindingExplanations(result: CheckResult, help: string): CheckResult {
    const findings = result.findings.map(({ help: own, ...finding }) => ({
        ...finding,
        explain: formatExplainCommand(finding),
        ...(own !== undefined && own !== help && { help: own }),
    }));
    return { ...result, ...(findings.length > 0 && { help }), findings };
}

/**
Build the report of a run that checked nothing. Every report starts from it.

@param stage the stage that the run selected.
@param started when the run started.
@param notes what the report says about the run.
*/
export function buildEmptyRunReport(stage: RunOptions['stage'], started: Date, notes: string[]): RunReport {
    const stages = REPORT_STAGES[stage];
    const duration = Date.now() - started.getTime();
    return {
        version: cliPackage.version,
        notes,
        stages,
        started: started.toISOString(),
        duration,
        checks: [],
        ignores: [],
        baselined: {},
        unstagedChanges: 0,
        partial: true,
        failed: [],
        exitCode: 0,
    };
}

/**
Build the check results, detected configuration warning, and exit status of a finished run.

@param run the planned checks and their results.
*/
export function buildRunReport(run: FinishedRun): RunReport {
    const { session, options, comparison, started, planned, results: ran, fixes, baselined } = run;
    const results = new Map(run.active.map((check, index) => [check, ran[index] as CheckResult]));
    const checks = planned.map((check) =>
        addFindingExplanations(
            results.get(check) ?? {
                ...buildBaseResult(check, session),
                status: 'skipped',
                cause: check.skip?.cause ?? 'no-files',
                note: check.skip?.note ?? NO_FILES_MESSAGE,
            },
            check.check.help,
        ),
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
        ...(comparison !== undefined && { comparison }),
        ...buildEmptyRunReport(options.stage, started, notes),
        checks: checks.map(({ reportNotes: _notes, span: _span, ...check }) => check),
        ignores: session.settings.ignore,
        baselined,
        unstagedChanges: options.selection?.unstagedChanges ?? 0,
        partial: options.selection?.paths !== undefined || options.paths !== undefined,
        failed,
        exitCode: code,
    };
}

/**
Name what a run reads.

@param comparison the content that the run selected, if any.
*/
export function formatCheckedContent(comparison: CheckProgress['comparison']): string {
    if (comparison?.content === 'index') return STAGED_FILES;
    return comparison?.content === 'commit'
        ? `commit ${comparison.reference.slice(0, SHORT_HASH_LENGTH)}`
        : WORKING_TREE;
}

/**
Rewrite the progress line when stderr takes one. Otherwise print a line only for the checks that run past the progress
interval: the checks still running at each interval, and a check that finishes after it.

@param progress the last finished check, or the checks still running, and the place in the run.
*/
export function printProgress(progress: CheckProgress): void {
    const subject = formatCheckedContent(progress.comparison);
    if (rewriteProgress(`Checking ${subject}: ${String(progress.finished)} of ${String(progress.total)} checks done`))
        return;
    if (progress.kind === 'running') {
        const seconds = (progress.elapsed / MILLISECONDS_PER_SECOND).toFixed(1);
        if (progress.running.length > 0)
            writeProgress(`running  ${formatRunningChecks(progress.running)}  ${seconds}s\n`);
        return;
    }
    if (progress.duration < PROGRESS_INTERVAL_MILLISECONDS) return;
    const scope = progress.scope === '' ? '' : `${formatScope(progress.scope)}  `;
    const seconds = (progress.duration / MILLISECONDS_PER_SECOND).toFixed(1);
    writeProgress(`done  ${scope}${progress.check}  ${seconds}s\n`);
}
