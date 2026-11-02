import { formatScope } from '#cli/system/text.ts';
import type { Session } from '#cli/types/tools.ts';
import { writeProgress } from '#cli/system/terminal.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { EXIT_ERROR, MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { listUnparsedDependencyFiles } from '#cli/repository/dependencies.ts';
import { buildBaseResult, formatExplainCommand } from '#cli/engine/results.ts';
import type { FixReport, RunReport, CheckResult, FinishedRun, CheckProgress } from '#cli/types/engine/run.ts';

import {
    STAGED_FILES,
    WORKING_TREE,
    EXIT_FINDINGS,
    REPORT_STAGES,
    PROGRESS_CLEAR,
    FAILED_STATUSES,
    NO_FILES_MESSAGE,
    SHORT_HASH_LENGTH,
    INCOMPLETE_STATUSES,
} from '#cli/config/engine.ts';

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
Build the check results, detected configuration warning, and exit status of a finished run.

@param run the planned checks and their results.
*/
export function buildRunReport(run: FinishedRun): RunReport {
    const { session, options, started, planned, results: ran, fixes, baselined } = run;
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
    return {
        ...(options.comparison !== undefined && { comparison: options.comparison }),
        version: cliPackage.version,
        notes: [
            ...listUnparsedDependencyFiles(session.repository.files, session.repository.dependencyFiles).map(
                (path) => `${path} does not parse, so gspot read no dependencies from it.`,
            ),
            ...checks.flatMap(({ reportNotes }) => reportNotes ?? []),
        ],
        stages: REPORT_STAGES[options.stage],
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks: checks.map(({ reportNotes: _notes, ...check }) => check),
        ignores: session.settings.ignore,
        baselined,
        unstagedChanges: options.unstagedChanges ?? 0,
        partial: [options.staged, options.changed, options.paths].some((selection) => selection !== undefined),
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
Rewrite the progress line when stderr points to a terminal, and print one line per finished check otherwise.

@param progress the last finished check and its place in the run.
*/
export function printProgress(progress: CheckProgress): void {
    if (!process.stderr.isTTY) {
        const scope = progress.scope === '' ? '' : `${formatScope(progress.scope)}  `;
        const seconds = (progress.duration / MILLISECONDS_PER_SECOND).toFixed(1);
        writeProgress(`done  ${scope}${progress.check}  ${seconds}s\n`);
        return;
    }
    const subject = formatCheckedContent(progress.comparison);
    writeProgress(
        `${PROGRESS_CLEAR}Checking ${subject}: ${String(progress.finished)} of ${String(progress.total)} checks done`,
    );
}
