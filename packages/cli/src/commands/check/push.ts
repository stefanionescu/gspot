// Check each revision that a push sends in its own scratch copy, and write one report for the push.

import { checkTree } from '#cli/commands/check/tree.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import type { RunReport } from '#cli/types/runs/check.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { selectPush } from '#cli/repository/revisions/push.ts';
import { type PushReport, type CheckOptions } from '#cli/types/commands/check.ts';
import { type PushRevision, type PushSelection } from '#cli/types/repository/revisions.ts';

// Check one pushed commit in a scratch copy. Return undefined when the signal stops the run.
async function checkRevision(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision: PushRevision,
): Promise<CommandResult<RunReport> | undefined> {
    try {
        using copy = await copyRevision(root, { kind: 'commit', hash: revision.hash }, signal);
        return await checkTree(copy.root, options, signal, {
            base: revision.base,
            commits: revision.commits,
            historyComplete: revision.historyComplete,
            content: 'commit',
            installedRoot: root,
            reference: revision.hash,
            ...(revision.paths === undefined ? {} : { changed: revision.paths }),
        });
    } catch (error) {
        if (!signal.aborted) throw error;
        return undefined;
    }
}

// Build the push report: the checked revisions, the updates that no check covers, and the refs that a cancellation left.
function buildPushReport(selected: PushSelection, revisions: PushReport['revisions'], signal: AbortSignal): PushReport {
    const pendingRefs = selected.revisions.slice(revisions.length).flatMap((revision) => revision.refs);
    const exitCode = Math.max(0, ...revisions.map((revision) => revision.report.exitCode));
    return {
        revisions,
        skipped: selected.skipped,
        exitCode,
        ...(signal.aborted ? { canceled: { pendingRefs } } : {}),
    };
}

/**
 * Check each revision that the pre-push input names, each in a scratch copy.
 *
 * @param repositoryRoot the working tree that gives the settings and gets the push report.
 * @param options the parsed flags, with the pre-push input.
 * @param signal stops the run.
 * @returns the command result for the push.
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
