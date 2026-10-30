import { join } from 'node:path';
import { runGit } from '#cli/system/git.ts';
import { formatCount } from '#cli/system/text.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { buildBaseResult, mergeCheckResults } from '#cli/runs/results.ts';
import { type CheckResult, type CheckFinding } from '#cli/types/runs/check.ts';
import { getSiblingCommand, listPushedCommits } from '#cli/checks/cross-configuration/pushed-commits.ts';

import {
    MESSAGE_FILE,
    SCISSORS_LINE,
    COMMENT_PREFIX,
    COMMITLINT_CHECK,
    MESSAGE_REFERENCES,
    GIT_COMMIT_MESSAGE_ARGUMENTS,
} from '#cli/config/checks/general/commits.ts';

/**
Checks every pushed commit message, including empty commits that change no files.

@param session the repository and its tools.
@param planned the commitlint check and commit range.
*/
export async function checkCommitlintPushed(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    using folder = createTemporaryFolder();
    const commits = await listPushedCommits(session, planned);
    if (!Array.isArray(commits)) return commits;
    const results = await Promise.all(
        commits.map(async (commit, index): Promise<CheckResult> => {
            const commitFile = join(folder.path, `${String(index)}-${MESSAGE_FILE}`);
            const read = await session.limitProcess(() =>
                runGit(session.root, [...GIT_COMMIT_MESSAGE_ARGUMENTS, commit, '--'], {
                    cancelSignal: session.cancelSignal,
                }),
            );
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
    );
    let result = { ...buildBaseResult(planned, session), fileCount: 0 };
    for (const next of results) result = mergeCheckResults(result, next);
    return result.status === 'passed' || result.status === 'failed'
        ? { ...result, note: `Checked ${formatCount(commits.length, 'commit message')}.` }
        : result;
}

/**
Report each line of a new commit message that links to an AI session.

@param _session the repository and its tools.
@param planned the check and the commit message file.
*/
export function checkReferences(_session: CheckSession, planned: PlannedCheck): CheckFinding[] {
    if (planned.messageFile === undefined) return [];
    const [message = ''] = readFileSync(planned.messageFile, 'utf8').split(SCISSORS_LINE, 1);
    return message.split('\n').flatMap((line, index) =>
        line.startsWith(COMMENT_PREFIX)
            ? []
            : MESSAGE_REFERENCES.filter(({ pattern }) => pattern.test(line)).map(({ rule, message: text }) => ({
                  file: '',
                  rule,
                  message: `Line ${String(index + 1)} ${text}`,
              })),
    );
}
