import { join } from 'node:path';
import { formatCount } from '#cli/system/text.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { type PlannedCheck } from '#cli/types/engine/planning.ts';
import { runGit, readGitSetting } from '#cli/repository/git/run.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { buildBaseResult, mergeCheckResults } from '#cli/engine/results.ts';
import { type CheckResult, type CheckFinding } from '#cli/types/engine/check.ts';
import { getSiblingCommand, listPushedCommits } from '#cli/checks/cross-configuration/pushed-commits.ts';

import {
    MESSAGE_FILE,
    COMMIT_SCISSORS,
    COMMITLINT_CHECK,
    MESSAGE_REFERENCES,
    GIT_COMMIT_MESSAGE_ARGUMENTS,
} from '#cli/config/checks/general/general.ts';

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

@param session the repository and its tools.
@param planned the check and the commit message file.
*/
export async function checkReferences(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    if (planned.messageFile === undefined) return [];
    const text = readFileSync(planned.messageFile, 'utf8');
    const scissors = COMMIT_SCISSORS.exec(text);
    const comment =
        scissors === null ? await readGitSetting(session.root, 'core.commentChar') : scissors[0].slice(0, 1);
    const prefix = comment?.length === 1 ? comment : '#';
    const message = text.slice(0, scissors?.index ?? text.length);
    return message.split('\n').flatMap((line, index) =>
        line.startsWith(prefix)
            ? []
            : MESSAGE_REFERENCES.filter(({ pattern }) => pattern.test(line)).map(({ rule, message: text }) => ({
                  file: '',
                  rule,
                  message: `Line ${String(index + 1)} ${text}`,
              })),
    );
}
