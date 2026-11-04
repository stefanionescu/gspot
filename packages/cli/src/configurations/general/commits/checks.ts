import { join } from 'node:path';
import { remember } from '#cli/system/cache.ts';
import { formatCount } from '#cli/system/text.ts';
import { PRIVATE_FILE } from '#cli/config/system.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { runGit, readGitSetting } from '#cli/repository/git/run.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readPushedCommits } from '#cli/repository/revisions/push.ts';
import type { CommitMessage } from '#cli/types/configurations/general.ts';
import { buildBaseResult, mergeCheckResults } from '#cli/engine/results.ts';
import { REFERENCE_EXPLANATIONS } from '#cli/configurations/general/commits/explanations.ts';
import { type CheckCode, type CheckResult, type CheckSession } from '#cli/types/engine/run.ts';

import {
    MESSAGE_FILE,
    COMMIT_SCISSORS,
    COMMIT_FIELD_END,
    COMMIT_RECORD_END,
    MESSAGE_REFERENCES,
    GIT_COMMIT_MESSAGE_ARGUMENTS,
} from '#cli/config/configurations/general.ts';

const COMMENT_CHARACTER = Symbol('comment character');

/**
Checks every pushed commit message, including empty commits that change no files.

@param session the repository, its tools, and the pushed commits of the run.
@param planned the configured commitlint check.
*/
async function checkCommitlintPushed(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    using folder = createTemporaryFolder();
    const commits = session.selection?.commits ?? (await readPushedCommits(session.toolsRoot, session.cancelSignal));
    const read = await session.limitProcess(() =>
        runGit(session.root, GIT_COMMIT_MESSAGE_ARGUMENTS, {
            stdin: `${commits.join('\n')}\n`,
            cancelSignal: session.cancelSignal,
        }),
    );
    if (read.code !== 0)
        return {
            ...buildBaseResult(planned, session),
            status: 'error',
            note: `Cannot read the pushed commit messages: ${read.stderr.trim()}`,
        };
    const records = read.stdout.split(COMMIT_RECORD_END).slice(0, commits.length);
    const results = await Promise.all(
        records.map(async (record, index): Promise<CheckResult> => {
            const [commit, message] = record.split(COMMIT_FIELD_END) as [string, string];
            const commitFile = join(folder.path, `${String(index)}-${MESSAGE_FILE}`);
            writeFileSync(commitFile, message, { mode: PRIVATE_FILE });
            const checked = await runCommandCheck(
                { ...session, selection: { content: 'message', messageFile: commitFile } },
                planned,
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

@param session the repository, its tools, and the commit message file of the run.
*/
async function checkReferences(session: CheckSession): Promise<CheckFinding[]> {
    const messageFile = session.selection?.messageFile;
    if (messageFile === undefined) return [];
    const { text: message, prefix } = await readCommitMessage(session, messageFile);
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

/**
Read a commit message without the comment lines and the diff that Git adds to the message file. The checks of one run
share one read of `core.commentChar`.

@param session the repository and its tools.
@param messageFile the file that Git passes to the commit-msg hook.
*/
export async function readCommitMessage(session: CheckSession, messageFile: string): Promise<CommitMessage> {
    const text = readFileSync(messageFile, 'utf8');
    const scissors = COMMIT_SCISSORS.exec(text);
    const comment =
        scissors === null
            ? await remember(session.cache, COMMENT_CHARACTER, session.root, () =>
                  readGitSetting(session.root, 'core.commentChar'),
              )
            : scissors[0].slice(0, 1);
    const prefix = comment?.length === 1 ? comment : '#';
    return { text: text.slice(0, scissors?.index ?? text.length), prefix };
}

export const COMMITS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'commits/commitlint-pushed': { run: checkCommitlintPushed },
    'commits/references': { check: checkReferences, explanations: REFERENCE_EXPLANATIONS },
};
