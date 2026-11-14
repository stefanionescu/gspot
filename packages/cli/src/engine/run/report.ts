import type { Session } from '#cli/types/tools.ts';
import { buildBaseResult } from '#cli/engine/results.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { EXIT_ERROR, EXIT_FINDINGS } from '#cli/config/system.ts';
import { formatExplainCommand } from '#cli/engine/outputs/rules.ts';
import { listUnparsedDependencyFiles } from '#cli/repository/projects/dependencies.ts';
import type { FixReport, RunReport, RunOptions, CheckResult, FinishedRun } from '#cli/types/engine/run.ts';
import { REPORT_STAGES, FAILED_STATUSES, NO_FILES_MESSAGE, INCOMPLETE_STATUSES } from '#cli/config/engine.ts';

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
