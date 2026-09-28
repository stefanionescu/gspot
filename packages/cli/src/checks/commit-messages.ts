import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runToolCommand } from '#cli/tools/command.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import type { CheckResult } from '#cli/types/checks/checks.ts';
import { pushBase } from '#cli/repository/revisions/selection.ts';
import type { PlannedCheck, Session } from '#cli/types/execution/execution.ts';

async function selectedCommits(session: Session, planned: PlannedCheck): Promise<string[] | { error: string }> {
    if (planned.commits !== undefined) return planned.commits;
    const listed = await runToolCommand(
        planned.scope.view,
        ['git', 'rev-list', `${await pushBase(session.root, session.cancelSignal)}..HEAD`, '--'],
        { cwd: session.root },
        session.cancelSignal,
    );
    if (listed.code !== 0) return { error: `Cannot select commit messages: ${listed.stderr.trim()}` };
    return listed.stdout.split('\n').filter(Boolean);
}

/**
 * Check every selected commit message, including empty commits with identical source trees.
 * @param session the open session
 * @param planned the planned check
 * @returns the check result
 */
export async function checkCommitMessages(session: Session, planned: PlannedCheck): Promise<CheckResult> {
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
        return { ...result, status: 'skipped', note: 'Commit messages require a Git repository.' };
    const commits = await selectedCommits(session, planned);
    if (!Array.isArray(commits)) return { ...result, status: 'error', note: commits.error };
    const scratch = mkdtempSync(join(tmpdir(), 'gspot-messages-'));
    let checked = 0;
    const statuses = new Set<CheckResult['status']>();
    try {
        const commitFile = join(scratch, 'message.txt');
        for (const object of commits) {
            const read = await runToolCommand(
                planned.scope.view,
                ['git', 'show', '--no-patch', '--no-show-signature', '--format=%B', object, '--'],
                { cwd: session.root },
                session.cancelSignal,
            );
            if (read.code !== 0)
                return {
                    ...result,
                    status: 'error',
                    duration: performance.now() - started,
                    note: `Cannot read commit ${object}: ${read.stderr.trim()}`,
                };
            writeFileSync(commitFile, read.stdout, { mode: 0o600 });
            const current = await runToolCheck(session, { ...planned, messageFile: commitFile }, [
                'commitlint',
                '--config',
                '{config:commitlint}',
                '--edit',
                '{message_file}',
            ]);
            result.findings.push(
                ...current.findings.map((finding) => ({ ...finding, message: `${object}: ${finding.message}` })),
            );
            checked++;
            if (['missing', 'error'].includes(current.status))
                return { ...current, findings: result.findings, duration: performance.now() - started };
            statuses.add(current.status);
        }
        return {
            ...result,
            status: statuses.has('fail') ? 'fail' : 'ok',
            duration: performance.now() - started,
            note: `Checked ${String(checked)} commit messages.`,
        };
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
