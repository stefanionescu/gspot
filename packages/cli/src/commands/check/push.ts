// Checking every revision a push sends, each in its own copy, with one report for the push.

import { EXIT_ERROR } from '#cli/config/terminal.ts';
import { checkTree } from '#cli/commands/check/tree.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { selectPush } from '#cli/repository/revisions/push.ts';
import { copyRevision } from '#cli/checks/run/copy/revision.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { type PushReport, type CheckOptions } from '#cli/types/commands/check.ts';
import { type PushRevision, type PushSelection } from '#cli/types/repository/revisions.ts';
// Checks one pushed commit in a copy of it, or undefined when the signal stopped the run.
async function checkRevision(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision: PushRevision,
): Promise<CommandResult<RunReport> | undefined> {
    try {
        return await copyRevision(
            root,
            { kind: 'commit', hash: revision.hash },
            (scratch) =>
                checkTree(scratch, options, signal, {
                    base: revision.base,
                    commits: revision.commits,
                    historyComplete: revision.historyComplete,
                    content: 'commit',
                    installedRoot: root,
                    reference: revision.hash,
                    ...(revision.paths === undefined ? {} : { changed: revision.paths }),
                }),
            signal,
        );
    } catch (error) {
        if (!signal.aborted) throw error;
        return undefined;
    }
}

// The push report: every checked revision, the updates no check applies to, and what a cancellation left.
function buildPushReport(selected: PushSelection, revisions: PushReport['revisions'], signal: AbortSignal): PushReport {
    const pendingRefs = selected.revisions.slice(revisions.length).flatMap((revision) => revision.refs);
    const exitCode = Math.max(
        signal.aborted ? EXIT_ERROR : 0,
        ...revisions.map((revision) => revision.report.exitCode),
    );
    return {
        revisions,
        skipped: selected.skipped,
        exitCode,
        ...(signal.aborted ? { canceled: { pendingRefs } } : {}),
    };
}

/**
 * Checks the revisions Git's pre-push protocol names, each in an exact copy.
 * @param repositoryRoot the working tree that supplies settings and receives the push report.
 * @param options the parsed flags, with the pre-push input.
 * @param signal cancellation for the run.
 * @returns the text to print, the push report, and the exit code.
 */
export async function checkPush(
    repositoryRoot: string,
    options: CheckOptions & { push: NonNullable<CheckOptions['push']> },
    signal: AbortSignal,
): Promise<CommandResult<PushReport>> {
    const selected = await selectPush(repositoryRoot, options.push.stdin, options.push.remote, signal);
    const revisions: PushReport['revisions'] = [];
    const text: string[] =
        selected.revisions.length === 0 && selected.skipped.length === 0
            ? ['The push sends no commits to check.\n']
            : [];
    for (const revision of selected.revisions) {
        const result = await checkRevision(repositoryRoot, options, signal, revision);
        if (result === undefined) break;
        revisions.push({
            hash: revision.hash,
            refs: revision.refs,
            commits: revision.commits,
            historyComplete: revision.historyComplete,
            report: result.json,
        });
        text.push(`${revision.refs.join(', ')} at ${revision.hash}\n${result.text}`);
    }
    const report = buildPushReport(selected, revisions, signal);
    if (report.canceled !== undefined)
        text.push(
            `Push checks canceled. Branches and tags not checked: ${report.canceled.pendingRefs.join(', ') || 'none; see canceled checks above'}.\n`,
        );
    const skipped = selected.skipped.map((entry) => `${entry.ref}: ${entry.reason}; no source check applies.\n`);
    return { text: [...text, ...skipped].join(''), json: report, exitCode: report.exitCode };
}
