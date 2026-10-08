import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runGit } from '#cli/platform/git/public.ts';
import { historyResult } from '#cli/execution/report.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { CheckResult } from '#cli/types/execution/check.ts';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import { pushedCommits } from '#cli/repository/revisions/public.ts';

/**
 * Check every selected commit message, including empty commits with identical source trees.
 * @param session the open session
 * @param planned the planned check
 * @returns the check result
 */
export async function commitlintPushed(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const result = historyResult(session, planned, 'Commit messages require a Git repository.');
    if (result.status === 'skipped') return result;
    const commits = await pushedCommits(session.root, planned.commits, session.cancelSignal);
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
        const current = await runCheckCommand(
            session,
            { ...planned, messageFile: commitFile },
            { command: ['commitlint', '--config', '{tool_file:commitlint}', '--edit', '{message_file}'] },
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
