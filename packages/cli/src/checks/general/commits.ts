import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runGit } from '#cli/platform/git.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { PRIVATE_FILE } from '#cli/config/platform/root.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { getPushBase } from '#cli/repository/revisions/changes.ts';
import { runCommandCheck } from '#cli/execution/command/runner.ts';
import type { CommitSelection } from '#cli/types/repository/revisions.ts';
import type { CheckResult, PlannedCheck } from '#cli/types/execution/runtime.ts';

async function pushedCommits(session: Session, planned: PlannedCheck): Promise<CommitSelection> {
    if (planned.commits !== undefined) return planned.commits;
    const base = await getPushBase(session.root, session.cancelSignal);
    const listed = await runGit(session.root, ['rev-list', `${base}..HEAD`, '--'], {
        cancelSignal: session.cancelSignal,
    });
    if (listed.code !== 0) return { error: `Cannot select commit messages: ${listed.stderr.trim()}` };
    return listed.stdout.split('\n').filter(Boolean);
}

/**
 * Check every selected commit message, including empty commits with identical source trees.
 * @param session the open session
 * @param planned the planned check
 * @returns the check result
 */
export async function commitlintRange(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const result: CheckResult = {
        check: planned.spec.name,
        scope: planned.scope.scope.path,
        status: 'passed',
        fileCount: 0,
        findings: [],
        duration: 0,
    };
    if (!session.repository.hasGit)
        return { ...result, status: 'skipped', note: 'Commit messages require a Git repository.' };
    const commits = await pushedCommits(session, planned);
    if (!Array.isArray(commits)) return { ...result, status: 'error', note: commits.error };
    using folder = scratchFolder('gspot-messages-');
    const scratch = folder.path;
    let hasFailed = false;
    const commitFile = join(scratch, 'message.txt');
    for (const commit of commits) {
        const read = await runGit(
            session.root,
            ['show', '--no-patch', '--no-show-signature', '--format=%B', commit, '--'],
            { cancelSignal: session.cancelSignal },
        );
        if (read.code !== 0)
            return {
                ...result,
                status: 'error',
                duration: performance.now() - started,
                note: `Cannot read commit ${commit}: ${read.stderr.trim()}`,
            };
        writeFileSync(commitFile, read.stdout, { mode: PRIVATE_FILE });
        const current = await runCommandCheck(
            session,
            { ...planned, messageFile: commitFile },
            { command: ['commitlint', '--config', '{config:commitlint}', '--edit', '{message_file}'] },
        );
        result.findings.push(
            ...current.findings.map((finding) => ({ ...finding, message: `${commit}: ${finding.message}` })),
        );
        if (['missing', 'error'].includes(current.status))
            return { ...current, findings: result.findings, duration: performance.now() - started };
        hasFailed ||= current.status === 'failed';
    }
    return {
        ...result,
        status: hasFailed ? 'failed' : 'passed',
        duration: performance.now() - started,
        note: `Checked ${String(commits.length)} commit messages.`,
    };
}
