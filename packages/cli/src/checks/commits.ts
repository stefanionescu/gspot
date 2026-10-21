import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runGit } from '#cli/system/git.ts';
import { type Session } from '#cli/types/session.ts';
import { buildBaseResult } from '#cli/runs/report.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { getSiblingCommand, runOverPushedCommits } from '#cli/runs/commits.ts';
import { MESSAGE_FILE, COMMITLINT_CHECK, GIT_COMMIT_MESSAGE_ARGUMENTS } from '#cli/config/checks/commits.ts';

/**
 * Checks every pushed commit message, including empty commits that change no files.
 *
 * @param session the repository and its tools.
 * @param planned the commitlint check and commit range.
 * @returns the check result.
 */
export async function checkCommitsCommitlintPushed(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    using folder = createTemporaryFolder();
    const commitFile = join(folder.path, MESSAGE_FILE);
    let count = 0;
    const result = await runOverPushedCommits(session, planned, async (commit) => {
        const read = await runGit(session.root, [...GIT_COMMIT_MESSAGE_ARGUMENTS, commit, '--'], {
            cancelSignal: session.cancelSignal,
        });
        if (read.code !== 0)
            return {
                ...buildBaseResult(planned, session),
                status: 'error',
                note: `Cannot read commit ${commit}: ${read.stderr.trim()}`,
            };
        writeFileSync(commitFile, read.stdout, { mode: PRIVATE_FILE });
        const current = await runCheckCommand(
            session,
            { ...planned, messageFile: commitFile },
            { command: getSiblingCommand(planned, COMMITLINT_CHECK) },
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
