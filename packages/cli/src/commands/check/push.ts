// Checking every revision a push sends, each in its own snapshot, with one report for the push.
import { writeReport } from '#cli/output/report.ts';
import { checkContent } from '#cli/commands/check/content.ts';
import { SelectionError } from '#cli/configurations/select.ts';
import { CANCELED_EXIT } from '#cli/constants/commands/check.ts';
import type { PushReport } from '#cli/types/execution/execution.ts';
import type { CommandResult } from '#cli/types/commands/commands.ts';
import type { PushSelection } from '#cli/types/repository/revisions.ts';
import { withRevisionSnapshot } from '#cli/repository/revisions/snapshot.ts';
import { pushedRevisions } from '#cli/repository/revisions/push-selection.ts';
import type { Checked, PushedRevision, CheckCommandResult, CheckOptions } from '#cli/types/commands/check.ts';

// Refuses the options that select or change files, which a push of exact objects cannot honor.
function assertPushOptions(options: CheckOptions): void {
    const isCombined =
        options.staged ||
        options.changed !== undefined ||
        options.fix ||
        options.stage !== undefined ||
        options.messageFile !== undefined;
    if (isCombined)
        throw new SelectionError([
            'Pre-push object checks cannot be combined with staged, changed, fix, stage, or message-file options.',
        ]);
}

// Checks one pushed commit in a snapshot of it, or undefined when the run was canceled.
async function checkRevision(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision: PushedRevision,
): Promise<CheckCommandResult | undefined> {
    try {
        return await withRevisionSnapshot(
            root,
            { kind: 'commit', object: revision.object },
            (snapshot) =>
                checkContent(snapshot, options, signal, {
                    commits: revision.commits,
                    historyComplete: revision.historyComplete,
                    content: 'commit',
                    cacheRoot: root,
                    reference: revision.object,
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
function pushReport(selected: PushSelection, revisions: Checked[], signal: AbortSignal): PushReport {
    const pendingRefs = selected.revisions.slice(revisions.length).flatMap((revision) => revision.refs);
    const exitCode = Math.max(
        signal.aborted ? CANCELED_EXIT : 0,
        ...revisions.map((revision) => revision.report.exitCode),
    );
    return {
        revisions,
        notApplicable: selected.notApplicable,
        exitCode,
        ...(signal.aborted ? { canceled: { pendingRefs } } : {}),
    };
}

/**
 * Checks the revisions Git's pre-push protocol names, each in an exact snapshot.
 * @param root the repository root
 * @param options the parsed flags, with the pre-push input
 * @param input what Git handed the pre-push hook
 * @param input.input the ref and object lines on standard input
 * @param input.remote the remote name, when Git gave one
 * @param signal cancellation for the run
 * @returns the text to print, the push report, and the exit code
 */
export async function checkPushed(
    root: string,
    options: CheckOptions,
    input: { input: string; remote?: string },
    signal: AbortSignal,
): Promise<CommandResult> {
    assertPushOptions(options);
    const selected = await pushedRevisions(root, input.input, input.remote, signal);
    const revisions: Checked[] = [];
    const rendered: string[] = [];
    for (const revision of selected.revisions) {
        const result = await checkRevision(root, options, signal, revision);
        if (result === undefined) break;
        if (result.report === undefined) return result;
        revisions.push({ ...revision, report: result.report });
        rendered.push(`${revision.refs.join(', ')} at ${revision.object}\n${result.text}`);
    }
    const report = pushReport(selected, revisions, signal);
    if (report.canceled !== undefined)
        rendered.push(
            `Push checks canceled. References not checked: ${report.canceled.pendingRefs.join(', ') || 'none; see canceled checks above'}.\n`,
        );
    if (!options.isDryRun) writeReport(root, report);
    const skipped = selected.notApplicable.map((entry) => `${entry.ref}: ${entry.reason}; no source check applies.\n`);
    return { text: [...rendered, ...skipped].join(''), json: report, exitCode: report.exitCode };
}
