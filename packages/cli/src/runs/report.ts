import { quoteArgument } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import type { RunReport } from '#cli/types/runs/run.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import type { FixReport } from '#cli/types/runs/fixes.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { FAILED_STATUSES } from '#cli/config/runs/check.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { INCOMPLETE_STATUSES } from '#cli/config/runs/report.ts';
import { EXIT_ERROR, EXIT_FINDINGS } from '#cli/config/terminal.ts';
import type { FinishedRun, ReproduceOptions } from '#cli/types/runs/report.ts';

function listFailedChecks(results: CheckResult[], fixes: FixReport | undefined): string[] {
    const checks = results.filter((result) => FAILED_STATUSES.has(result.status)).map((result) => result.check);
    const failedFixers = (fixes?.results ?? []).flatMap((result) => (result.status === 'failed' ? [result.check] : []));
    return [...new Set([...checks, ...failedFixers])];
}

function isIncomplete(session: Session, results: CheckResult[], fixes: FixReport | undefined): boolean {
    if (session.cancelSignal?.aborted === true) return true;
    if (results.some((result) => INCOMPLETE_STATUSES.has(result.status))) return true;
    return fixes?.results.some((result) => result.status === 'failed') === true;
}

/**
 * Starts a passed check result with the check ID, scope, and file count.
 *
 * @param planned the check to run.
 * @param session the scopes of the run.
 * @returns a passed result with no findings.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 11 calls in 9 files share it.
export function buildBaseResult(planned: PlannedCheck, session: Pick<Session, 'scopes'>): CheckResult {
    return {
        check: planned.check.id,
        scope: planned.scope.folder.path,
        status: 'passed',
        fileCount: listCheckedFiles(session.scopes, planned).length,
        duration: 0,
        findings: [],
    };
}

/**
 * Merge repeated runs of one check. Keep their findings and the base file count.
 *
 * @param merged the results collected so far.
 * @param next the next run of the same check.
 * @returns the combined result, with a missing-tool or process failure when the next run stops.
 */
export function mergeCheckResults(merged: CheckResult, next: CheckResult): CheckResult {
    const stopped = next.status === 'missing' || next.status === 'error';
    const status = merged.status === 'failed' || next.status === 'failed' ? 'failed' : merged.status;
    return {
        ...merged,
        findings: [...merged.findings, ...next.findings],
        duration: merged.duration + next.duration,
        status: stopped ? next.status : status,
        ...(stopped ? { note: next.note, command: next.command } : {}),
    };
}

/**
 * Builds the report of a finished run, which check --json prints.
 *
 * @param run the plan and what ran.
 * @returns the checks and exit code.
 */
export function buildRunReport(run: FinishedRun): RunReport {
    const { session, options, started, planned, ran, ignores, fixes } = run;
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
    return {
        ...(options.comparison === undefined ? {} : { comparison: options.comparison }),
        version: cliPackage.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks,
        ignores: ignores.map((record) => ({
            ...(record.check === undefined ? {} : { check: record.check }),
            ...(record.rule === undefined ? {} : { rule: record.rule }),
            ...(record.paths === undefined ? {} : { paths: record.paths }),
            ...(record.names === undefined ? {} : { names: record.names }),
            reason: record.reason,
        })),
        unstagedChanges: options.unstagedChanges ?? 0,
        partial: [options.staged, options.changed, options.paths].some((selection) => selection !== undefined),
        failed,
        exitCode: code,
    };
}

/**
 * Formats the command that runs one check alone.
 *
 * @param checkId the ID to run.
 * @param scope the folder path, '' for the root.
 * @param options the file selection and hook arguments.
 * @param options.paths the path arguments as typed.
 * @param options.changed the compared reference, including the push base.
 * @param options.messageFile the file that Git passes to commit-msg.
 * @param options.staged whether the finding came from the index.
 * @returns the command line.
 */
export function formatReproduceCommand(checkId: string, scope: string, options: ReproduceOptions): string {
    const { paths, changed, messageFile, staged } = options;
    const words = ['gspot check'];
    if (paths.length > 0) words.push(...paths.map((path) => quoteArgument(path)));
    else if (scope !== '' && messageFile === undefined) words.push(quoteArgument(scope));
    words.push('--only', quoteArgument(checkId));
    if (changed !== undefined) words.push('--changed', quoteArgument(changed));
    if (messageFile !== undefined) words.push('--hook', 'commit-msg', '--', quoteArgument(messageFile));
    if (staged) words.push('--staged');
    return words.join(' ');
}
