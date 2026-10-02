import type { Session } from '#cli/types/tools/tools.ts';
import { fileBatches } from '#cli/execution/tool/batches.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import { getPushBase } from '#cli/repository/revisions/changes.ts';
import type { CheckResult, PlannedCheck } from '#cli/types/execution/execution.ts';

/**
 * Scan the exact selected commits, including secrets removed before the final pushed tree.
 * @param session the open session
 * @param planned the planned check
 * @returns the check result
 */
export async function checkSecretHistory(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const result: CheckResult = {
        check: planned.check,
        scope: planned.scope.scope.path,
        status: 'passed',
        fileCount: 0,
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
    let selections: string[] = [];
    if (planned.commits === undefined) selections = [`${await getPushBase(session.root, session.cancelSignal)}..HEAD`];
    else if (planned.commits.length > 0)
        selections = fileBatches(
            planned.commits,
            [...command, '--log-opts', '--no-walk --diff-merges=separate'],
            process.platform,
        ).map((commits) => `--no-walk --diff-merges=separate ${commits.join(' ')} --`);
    for (const selection of selections) {
        const current = await runToolCheck(session, planned, [...command, '--log-opts', selection]);
        result.findings.push(...current.findings);
        if (current.status === 'missing' || current.status === 'error')
            return { ...current, findings: result.findings, duration: performance.now() - started };
        if (current.status === 'failed') result.status = 'failed';
    }
    return { ...result, duration: performance.now() - started };
}
