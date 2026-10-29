import pLimit from 'p-limit';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runGit } from '#cli/system/git.ts';
import { availableParallelism } from 'node:os';
import { formatCount } from '#cli/system/text.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { buildBaseResult, mergeCheckResults } from '#cli/runs/results.ts';
import { getSiblingCommand, listPushedCommits } from '#cli/checks/pushed-commits.ts';
import { MESSAGE_FILE, COMMITLINT_CHECK, GIT_COMMIT_MESSAGE_ARGUMENTS } from '#cli/config/checks/general/commits.ts';

/**
Checks every pushed commit message, including empty commits that change no files.

@param session the repository and its tools.
@param planned the commitlint check and commit range.
*/
export async function checkCommitsCommitlintPushed(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    using folder = createTemporaryFolder();
    const commits = await listPushedCommits(session, planned);
    if (!Array.isArray(commits)) return commits;
    const limit = pLimit(availableParallelism());
    const results = await Promise.all(
        commits.map((commit, index) =>
            limit(async (): Promise<CheckResult> => {
                const commitFile = join(folder.path, `${String(index)}-${MESSAGE_FILE}`);
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
                const checked = await runCommandCheck(
                    session,
                    { ...planned, messageFile: commitFile },
                    { command: getSiblingCommand(planned, COMMITLINT_CHECK) },
                );
                return {
                    ...checked,
                    findings: checked.findings.map((finding) => ({
                        ...finding,
                        message: `${commit}: ${finding.message}`,
                    })),
                };
            }),
        ),
    );
    let result = { ...buildBaseResult(planned, session), fileCount: 0 };
    for (const next of results) result = mergeCheckResults(result, next);
    return result.status === 'passed' || result.status === 'failed'
        ? { ...result, note: `Checked ${formatCount(commits.length, 'commit message')}.` }
        : result;
}
