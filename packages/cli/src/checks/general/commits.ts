import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runGit } from '#cli/system/git.ts';
import { emptyResult } from '#cli/checks/run/report.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { type CheckResult } from '#cli/types/execution/check.ts';
import { runCheckCommand } from '#cli/checks/run/command/check.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { siblingCommand, runOverPushedCommits } from '#cli/checks/general/pushed-commits.ts';
import { MESSAGE_FILE, COMMITLINT_CHECK, COMMIT_MESSAGE_ARGUMENTS } from '#cli/config/checks/general/commits.ts';

/**
 * Check every selected commit message, including empty commits with identical source trees.
 * @param session the open session.
 * @param planned the planned check.
 * @returns the check result.
 */
export async function commitlintPushed(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    using folder = createScratchFolder();
    const commitFile = join(folder.path, MESSAGE_FILE);
    let count = 0;
    const result = await runOverPushedCommits(session, planned, async (commit) => {
        const read = await runGit(session.root, [...COMMIT_MESSAGE_ARGUMENTS, commit, '--'], {
            cancelSignal: session.cancelSignal,
        });
        if (read.code !== 0)
            return {
                ...emptyResult(planned),
                status: 'error',
                note: `Cannot read commit ${commit}: ${read.stderr.trim()}`,
            };
        writeFileSync(commitFile, read.stdout, { mode: PRIVATE_FILE });
        const current = await runCheckCommand(
            session,
            { ...planned, messageFile: commitFile },
            { command: siblingCommand(planned, COMMITLINT_CHECK) },
        );
        count += 1;
        return {
            ...current,
            findings: current.findings.map((finding) => ({ ...finding, message: `${commit}: ${finding.message}` })),
        };
    });
    return result.status === 'passed' || result.status === 'failed'
        ? { ...result, note: `Checked ${String(count)} commit messages.` }
        : result;
}
