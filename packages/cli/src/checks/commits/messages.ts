import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { pushBase } from '#cli/repository/staged.ts';
import { runToolCheck, runToolCommand } from '#cli/run/tool-runner.ts';
import type { CheckResult } from '#cli/types/reports.ts';
import type { Session, PlannedCheck } from '#cli/types/execution.ts';

/** Check every selected commit message, including empty commits with identical source trees. */
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
    let commits = planned.commits;
    if (commits === undefined) {
        const listed = await runToolCommand(
            planned.scope.view,
            ['git', 'rev-list', `${await pushBase(session.root, session.cancelSignal)}..HEAD`, '--'],
            { cwd: session.root },
            session.cancelSignal,
        );
        if (listed.code !== 0)
            return { ...result, status: 'error', note: `Cannot select commit messages: ${listed.stderr.trim()}` };
        commits = listed.stdout.split('\n').filter(Boolean);
    }
    const scratch = mkdtempSync(join(tmpdir(), 'gspot-messages-'));
    let checked = 0;
    try {
        const message = join(scratch, 'message.txt');
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
            writeFileSync(message, read.stdout, { mode: 0o600 });
            const current = await runToolCheck(session, { ...planned, messageFile: message }, [
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
            if (current.status === 'missing' || current.status === 'error')
                return { ...current, findings: result.findings, duration: performance.now() - started };
            if (current.status === 'fail') result.status = 'fail';
        }
        return {
            ...result,
            duration: performance.now() - started,
            note: `Checked ${String(checked)} commit messages.`,
        };
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
