import type { Session } from '#cli/execution/session.ts';
import type { PlannedCheck } from '#cli/execution/plan.ts';
import { pushBase } from '#cli/repository/staged.ts';
import { fileBatches } from '#cli/execution/file-batches.ts';
import { runToolCheck } from '#cli/execution/tool-runner.ts';
import type { CheckResult } from '#cli/checks/result.ts';

/**
 * Scan the exact selected commits, including secrets removed before the final pushed tree.
 * @param session
 * @param planned
 */
export async function checkSecretHistory(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const result: CheckResult = {
        check: planned.check,
        scope: planned.scope.scope.path,
        status: 'ok',
        files: 0,
        findings: [],
        duration: 0,
    };
    if (!session.repository.hasGit)
        return { ...result, status: 'skipped', note: 'Secret history requires a Git repository.' };
    const command = [
        'gitleaks',
        'git',
        '--no-banner',
        '--redact',
        '--exit-code',
        '1',
        '--config',
        '{config:gitleaks}',
        '{existing:--baseline-path:.gspot/gitleaks-baseline.json}',
        '--report-format',
        'csv',
        '--report-path',
        '-',
        '{root}',
    ];
    const selections =
        planned.commits === undefined
            ? [`${await pushBase(session.root, session.cancelSignal)}..HEAD`]
            : planned.commits.length === 0
              ? []
              : fileBatches(
                    planned.commits,
                    [...command, '--log-opts', '--no-walk --diff-merges=separate'],
                    process.platform,
                ).map((commits) => `--no-walk --diff-merges=separate ${commits.join(' ')} --`);
    for (const selection of selections) {
        const current = await runToolCheck(session, planned, [...command, '--log-opts', selection]);
        result.findings.push(...current.findings);
        if (current.status === 'missing' || current.status === 'error')
            return { ...current, findings: result.findings, duration: performance.now() - started };
        if (current.status === 'fail') result.status = 'fail';
    }
    return { ...result, duration: performance.now() - started };
}
