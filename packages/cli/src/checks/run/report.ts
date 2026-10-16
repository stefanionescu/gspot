// The report a run ends with: every result, the ignores that matched, the skips, and the exit code.
import { quoteArgument } from '#cli/system/text.ts';
import { EXIT_ERROR, EXIT_FINDINGS } from '#cli/config/terminal.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { FAILED_STATUSES, INCOMPLETE_STATUSES } from '#cli/config/execution/run.ts';
import type { FixReport, RunReport, CheckResult, ReportInput, ReproduceOptions } from '#cli/types/execution/check.ts';

// Name each failed or unavailable check and failed fixer once.
function failedChecks(results: CheckResult[], fixes: FixReport | undefined): string[] {
    const checks = results.filter((result) => FAILED_STATUSES.has(result.status)).map((result) => result.check);
    const corrections = (fixes?.results ?? []).flatMap((result) => (result.status === 'failed' ? [result.check] : []));
    return [...new Set([...checks, ...corrections])];
}

// Identify incomplete runs caused by cancellation, unavailable checks, or failed fixers.
function isIncomplete(session: Session, results: CheckResult[], fixes: FixReport | undefined): boolean {
    if (session.cancelSignal?.aborted === true) return true;
    if (results.some((result) => INCOMPLETE_STATUSES.has(result.status))) return true;
    return fixes?.results.some((result) => result.status === 'failed') === true;
}

/**
 * Start a result with its planned identity and selected file count.
 *
 * @param planned the selected check and scope.
 *
 * @returns a passed result before execution adds findings or a diagnostic.
 */
export function emptyResult(planned: PlannedCheck): CheckResult {
    return {
        check: planned.check.name,
        scope: planned.scope.scope.path,
        status: 'passed',
        fileCount: planned.files.length,
        duration: 0,
        findings: [],
    };
}

/**
 * The report of a finished run, which check --json prints.
 *
 * @param input the session, the options, the plan, and what ran.
 *
 * @returns the report.
 */
export function buildRunReport(input: ReportInput): RunReport {
    const { session, options, started, planned, ran, uses, fixes } = input;
    const failed = failedChecks(ran, fixes);
    let code = failed.length > 0 ? EXIT_FINDINGS : 0;
    if (isIncomplete(session, ran, fixes)) code = EXIT_ERROR;
    return {
        ...(options.comparison === undefined ? {} : { comparison: options.comparison }),
        version: session.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks: ran,
        ignores: uses
            .values()
            .map(({ entry, matched }) => ({
                check: entry.check,
                ...(entry.rule === undefined ? {} : { rule: entry.rule }),
                ...(entry.paths === undefined ? {} : { paths: entry.paths }),
                reason: entry.reason,
                matched,
            }))
            .toArray(),
        skips: planned.flatMap((check): RunReport['skips'] => {
            if (check.skip !== undefined) return [{ check: check.check.name, cause: check.skip.cause }];
            return input.active.includes(check) ? [] : [{ check: check.check.name, cause: 'inputs' }];
        }),
        unstagedChanges: options.unstagedChanges ?? 0,
        partial: [options.staged, options.changed, options.paths].some((selection) => selection !== undefined),
        failed,
        exitCode: code,
    };
}

/**
 * The command that runs one check alone.
 *
 * @param checkName the check ID.
 * @param scope the scope path, '' for the root.
 * @param options the message file or the exact push input.
 * @param options.push the pre-push input the check read.
 * @param options.push.stdin the lines Git handed the hook.
 * @param options.push.remote the remote name, when Git gave one.
 * @param options.messageFile the commit message file, which selects the message checks.
 * @param options.staged whether the finding used staged content.
 *
 * @returns the command line.
 */
export function reproduceLine(checkName: string, scope: string, options: ReproduceOptions): string {
    const { push, messageFile: commitFile, staged } = options;
    if (push !== undefined) {
        const remote = push.remote === undefined ? '' : ` -- ${quoteArgument(push.remote)}`;
        return `printf '%s' ${quoteArgument(push.stdin)} | gspot check --hook pre-push --only ${quoteArgument(checkName)}${remote}`;
    }
    const parts = ['gspot check'];
    if (scope !== '') parts.push(quoteArgument(scope));
    parts.push('--only', quoteArgument(checkName));
    if (commitFile !== undefined) parts.push('--message-file', quoteArgument(commitFile));
    if (staged === true) parts.push('--staged');
    return parts.join(' ');
}
