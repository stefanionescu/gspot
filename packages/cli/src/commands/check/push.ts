// Checking every revision a push sends, each in its own snapshot, with one report for the push.
import { GspotError } from '#cli/platform/errors.ts';
import { EXIT_ERROR } from '#cli/config/platform/platform.ts';
import { checkContent } from '#cli/commands/check/content.ts';
import { selectPush } from '#cli/repository/revisions/push.ts';
import type { CommandResult } from '#cli/types/commands/commands.ts';
import { checkOutRevision } from '#cli/execution/checkout/revision.ts';
import type { PushSelection } from '#cli/types/repository/revisions.ts';
import type { Checked, PushReport, CheckOptions, PushRevision, CheckCommandResult } from '#cli/types/commands/check.ts';

// Refuses the options that select or change files, which a push of exact objects cannot honor.
function assertPushOptions(options: CheckOptions): void {
    const hasConflict =
        options.staged ||
        options.changed !== undefined ||
        options.fix ||
        options.stage !== undefined ||
        options.messageFile !== undefined;
    if (hasConflict)
        throw new GspotError('selection', [
            'Pre-push object checks cannot be combined with --staged, --changed, --fix, --hook, or --message-file.',
        ]);
}

// Checks one pushed commit in a snapshot of it, or undefined when the run was canceled.
async function checkRevision(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision: PushRevision,
): Promise<CheckCommandResult | undefined> {
    try {
        return await checkOutRevision(
            root,
            { kind: 'commit', hash: revision.object },
            (checkout) =>
                checkContent(checkout, options, signal, {
                    commits: revision.commits,
                    historyComplete: revision.historyComplete,
                    content: 'commit',
                    installedRoot: root,
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
function buildReport(selected: PushSelection, revisions: Checked[], signal: AbortSignal): PushReport {
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
 * Checks the revisions Git's pre-push protocol names, each in an exact snapshot.
 * @param root the repository root.
 * @param options the parsed flags, with the pre-push input.
 * @param input what Git handed the pre-push hook.
 * @param input.input the ref and object lines on standard input.
 * @param input.remote the remote name, when Git gave one.
 * @param signal cancellation for the run.
 * @returns the text to print, the push report, and the exit code.
 */
export async function checkPush(
    root: string,
    options: CheckOptions,
    input: { input: string; remote?: string },
    signal: AbortSignal,
): Promise<CommandResult> {
    assertPushOptions(options);
    const selected = await selectPush(root, input.input, input.remote, signal);
    const revisions: Checked[] = [];
    const rendered: string[] = [];
    for (const revision of selected.revisions) {
        const result = await checkRevision(root, options, signal, revision);
        if (result === undefined) break;
        if (result.report === undefined) return result;
        revisions.push({
            object: revision.object,
            refs: revision.refs,
            commits: revision.commits,
            historyComplete: revision.historyComplete,
            report: result.report,
        });
        rendered.push(`${revision.refs.join(', ')} at ${revision.object}\n${result.text}`);
    }
    const report = buildReport(selected, revisions, signal);
    if (report.canceled !== undefined)
        rendered.push(
            `Push checks canceled. References not checked: ${report.canceled.pendingRefs.join(', ') || 'none; see canceled checks above'}.\n`,
        );
    const skipped = selected.skipped.map((entry) => `${entry.ref}: ${entry.reason}; no source check applies.\n`);
    return { text: [...rendered, ...skipped].join(''), json: report, exitCode: report.exitCode };
}
