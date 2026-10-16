import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runGit } from '#cli/system/git.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { type CheckResult } from '#cli/types/execution/check.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { pushedCommits } from '#cli/repository/revisions/changes.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { mergeRuns, historyResult } from '#cli/checks/general/history.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import { MESSAGE_FILE, COMMITLINT_CHECK, COMMIT_MESSAGE_ARGUMENTS } from '#cli/config/checks/general/commits.ts';

/**
 * Check every selected commit message, including empty commits with identical source trees.
 * @param session the open session.
 * @param planned the planned check.
 * @returns the check result.
 */
export async function commitlintPushed(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    let result = historyResult(session, planned, 'Commit messages require a Git repository.');
    if (result.status === 'skipped') return result;
    const commits = await pushedCommits(session.root, planned.commits, session.cancelSignal);
    if (!Array.isArray(commits)) return { ...result, status: 'error', note: commits.error };
    using folder = createScratchFolder();
    const scratch = folder.path;
    const commitFile = join(scratch, MESSAGE_FILE);
    for (const commit of commits) {
        const read = await runGit(session.root, [...COMMIT_MESSAGE_ARGUMENTS, commit, '--'], {
            cancelSignal: session.cancelSignal,
        });
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
            {
                command: (
                    (planned.manifest as Manifest).checks.find(
                        ({ name }) => name === COMMITLINT_CHECK,
                    ) as CheckDeclaration
                ).command as string[],
            },
        );
        result = mergeRuns([
            result,
            {
                ...current,
                findings: current.findings.map((finding) => ({ ...finding, message: `${commit}: ${finding.message}` })),
            },
        ]);
        if (result.status === 'missing' || result.status === 'error')
            return { ...result, duration: performance.now() - started };
    }
    return {
        ...result,
        duration: performance.now() - started,
        note: `Checked ${String(commits.length)} commit messages.`,
    };
}
