import { quoteArgument } from '#cli/system/text.ts';
import { listCoveredInputs } from '#cli/planning/checks.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { EXIT_ERROR, EXIT_FINDINGS } from '#cli/config/terminal.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { FAILED_STATUSES, INCOMPLETE_STATUSES } from '#cli/config/runs/run.ts';
import type { FixReport, RunReport, CheckResult, ReportInput, ReproduceOptions } from '#cli/types/runs/check.ts';

function listFailedChecks(results: CheckResult[], fixes: FixReport | undefined): string[] {
    const checks = results.filter((result) => FAILED_STATUSES.has(result.status)).map((result) => result.check);
    const corrections = (fixes?.results ?? []).flatMap((result) => (result.status === 'failed' ? [result.check] : []));
    return [...new Set([...checks, ...corrections])];
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
export function buildBaseResult(planned: PlannedCheck, session: Pick<Session, 'scopes'>): CheckResult {
    return {
        check: planned.check.name,
        scope: planned.selection.scope.path,
        status: 'passed',
        fileCount: listCoveredInputs(session.scopes, planned).length,
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
 * @param input the plan and what ran.
 * @returns the checks and exit code.
 */
export function buildRunReport(input: ReportInput): RunReport {
    const { session, options, started, planned, ran, ignores, fixes } = input;
    const results = new Map(input.active.map((check, index) => [check, ran[index] as CheckResult]));
    const checks = planned.map<CheckResult>(
        (check) =>
            results.get(check) ?? {
                ...buildBaseResult(check, session),
                status: 'skipped' as const,
                cause: check.skip?.cause ?? 'inputs',
                note: check.skip?.note ?? 'No matching files.',
            },
    );
    const failed = listFailedChecks(checks, fixes);
    let code = failed.length > 0 ? EXIT_FINDINGS : 0;
    if (isIncomplete(session, ran, fixes)) code = EXIT_ERROR;
    return {
        ...(options.comparison === undefined ? {} : { comparison: options.comparison }),
        version: packageManifest.version,
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
 * @param checkName the ID to run.
 * @param scope the folder path, '' for the root.
 * @param options the message file or the exact push input.
 * @param options.push the hook input that the check read.
 * @param options.push.stdin the lines Git handed the hook.
 * @param options.push.remote the name Git gave, if any.
 * @param options.messageFile the file that Git passes to commit-msg.
 * @param options.staged whether the finding came from the index.
 * @returns the command line.
 */
export function formatReproduceCommand(checkName: string, scope: string, options: ReproduceOptions): string {
    const { push, messageFile: commitFile, staged } = options;
    if (push !== undefined) {
        const remote = push.remote === undefined ? '' : ` -- ${quoteArgument(push.remote)}`;
        return `printf '%s' ${quoteArgument(push.stdin)} | gspot check --hook pre-push --only ${quoteArgument(checkName)}${remote}`;
    }
    const parts = ['gspot check'];
    if (scope !== '' && commitFile === undefined) parts.push(quoteArgument(scope));
    parts.push('--only', quoteArgument(checkName));
    if (commitFile !== undefined) parts.push('--hook', 'commit-msg', '--', quoteArgument(commitFile));
    if (staged) parts.push('--staged');
    return parts.join(' ');
}
