import { EXIT_ERROR } from '#cli/config/system.ts';
import type { Session } from '#cli/types/tools.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { listDetectedAdditions } from '#cli/repository/proposals.ts';
import { buildBaseResult, formatExplainCommand } from '#cli/engine/results.ts';
import type { FixReport, RunReport, CheckResult, FinishedRun } from '#cli/types/engine/run.ts';

import {
    EXIT_FINDINGS,
    REPORT_STAGES,
    FAILED_STATUSES,
    NO_FILES_MESSAGE,
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

function finishResult(result: CheckResult, help: string): CheckResult {
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
    const { session, options, started, planned, results: ran, fixes } = run;
    const results = new Map(run.active.map((check, index) => [check, ran[index] as CheckResult]));
    const checks = planned.map((check) =>
        finishResult(
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
    if (session.cancelSignal?.aborted === true && typeof session.cancelSignal.reason === 'number')
        code = session.cancelSignal.reason;
    return {
        ...(options.comparison !== undefined && { comparison: options.comparison }),
        ...buildNotCheckedReport(session),
        version: cliPackage.version,
        notes: [],
        stages: REPORT_STAGES[options.stage],
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
