import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runGit } from '#cli/platform/git.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { PRIVATE_FILE } from '#cli/config/platform/root.ts';
import { scratchFolder } from '#cli/platform/filesystem.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import { getPushBase } from '#cli/repository/revisions/changes.ts';
import type { CheckResult, PlannedCheck } from '#cli/types/execution/execution.ts';

async function pushedCommits(session: Session, planned: PlannedCheck): Promise<string[] | { error: string }> {
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
        check: planned.check,
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
    let checked = 0;
    const statuses = new Set<CheckResult['status']>();
    const commitFile = join(scratch, 'message.txt');
    for (const object of commits) {
        const read = await runGit(
            session.root,
            ['show', '--no-patch', '--no-show-signature', '--format=%B', object, '--'],
            { cancelSignal: session.cancelSignal },
        );
        if (read.code !== 0)
            return {
                ...result,
                status: 'error',
                duration: performance.now() - started,
                note: `Cannot read commit ${object}: ${read.stderr.trim()}`,
            };
        writeFileSync(commitFile, read.stdout, { mode: PRIVATE_FILE });
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
        status: statuses.has('failed') ? 'failed' : 'passed',
        duration: performance.now() - started,
        note: `Checked ${String(checked)} commit messages.`,
    };
}
