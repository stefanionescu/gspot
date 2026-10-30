import type { Session } from '#cli/types/session.ts';
import { buildBaseResult } from '#cli/runs/results.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { CheckResult } from '#cli/types/runs/check.ts';
import { INCOMPLETE_STATUSES } from '#cli/config/runs/results.ts';
import { FAILED_STATUSES } from '#cli/config/commands/check/run.ts';
import { EXIT_ERROR, EXIT_FINDINGS } from '#cli/config/terminal.ts';
import { NO_FILES_MESSAGE } from '#cli/config/commands/check/results.ts';
import { listDetectedAdditions } from '#cli/repository/configurations.ts';
import type { FixReport, RunReport, FinishedRun } from '#cli/types/commands/check.ts';

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

function buildNotCheckedReport(session: Session): Pick<RunReport, 'notChecked'> {
    const notChecked = [
        ...new Map(
            listDetectedAdditions(session).flatMap(({ evidence }) =>
                evidence.map(
                    ({ configuration, evidence: found }) =>
                        [configuration, { configuration, evidence: found }] as const,
                ),
            ),
        ).values(),
    ];
    if (notChecked.length === 0) return {};
    return { notChecked };
}

/**
Build the check results, detected configuration warning, and exit status of a finished run.

@param run the planned checks and their results.
*/
export function buildRunReport(run: FinishedRun): RunReport {
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
        ...buildNotCheckedReport(session),
        version: cliPackage.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks,
        ignores: session.settings.ignore,
        unstagedChanges: options.unstagedChanges ?? 0,
        partial: [options.staged, options.changed, options.paths].some((selection) => selection !== undefined),
        failed,
        exitCode: code,
    };
}
