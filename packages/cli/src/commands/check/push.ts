import { checkTree } from '#cli/commands/check/tree.ts';
import type { RunReport } from '#cli/types/runs/run.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { selectPush } from '#cli/repository/revisions/push.ts';
import { type PushReport, type CheckOptions } from '#cli/types/commands/check.ts';
import { type PushRevision, type PushedRevisions } from '#cli/types/repository/revisions.ts';

async function checkRevision(
    root: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
    revision: PushRevision,
): Promise<CommandResult<RunReport> | undefined> {
    try {
        using copy = await copyRevision(root, { kind: 'commit', hash: revision.hash }, cancelSignal);
        return await checkTree(copy.root, options, cancelSignal, {
            ...(copy.dependencyNote !== undefined && { dependencyNote: copy.dependencyNote }),
            base: revision.base,
            commits: revision.commits,
            shallow: revision.shallow,
            content: 'commit',
            installedRoot: root,
            reference: revision.hash,
            ...(revision.paths !== undefined && { changed: revision.paths }),
        });
    } catch (error) {
        if (!cancelSignal.aborted) throw error;
        return undefined;
    }
}

function buildPushReport(
    selected: PushedRevisions,
    revisions: PushReport['revisions'],
    cancelSignal: AbortSignal,
): PushReport {
    const pendingRefs = selected.revisions.slice(revisions.length).flatMap((revision) => revision.refs);
    const exitCode = cancelSignal.aborted
        ? Number(cancelSignal.reason)
        : Math.max(0, ...revisions.map((revision) => revision.report.exitCode));
    return {
        revisions,
        skipped: selected.skipped,
        exitCode,
        ...(cancelSignal.aborted && { canceled: { pendingRefs } }),
    };
}

/**
Check each revision that the pre-push input names, each in a copy.

@param root the working tree that gives the settings and gets the push report.
@param options the parsed flags, with the pre-push input.
@param cancelSignal stops the run.
@returns the command result for the push.
*/
export async function checkPush(
    root: string,
    options: CheckOptions & { push: NonNullable<CheckOptions['push']> },
    cancelSignal: AbortSignal,
): Promise<CommandResult<PushReport>> {
    const selected = await selectPush(root, options.push.stdin, options.push.remote, cancelSignal);
    const revisions: PushReport['revisions'] = [];
    const text: string[] =
        selected.revisions.length === 0 && selected.skipped.length === 0
            ? ['The push sends no commits to check.\n']
            : [];
    for (const revision of selected.revisions) {
        const result = await checkRevision(root, options, cancelSignal, revision);
        if (result === undefined) break;
        revisions.push({
            hash: revision.hash,
            refs: revision.refs,
            commits: revision.commits,
            shallow: revision.shallow,
            report: result.json,
        });
        text.push(`${revision.refs.join(', ')} at ${revision.hash}\n${result.text}`);
    }
    const report = buildPushReport(selected, revisions, cancelSignal);
    if (report.canceled !== undefined)
        text.push(
            `Push checks canceled. Branches and tags not checked: ${report.canceled.pendingRefs.join(', ') || 'none; see canceled checks above'}.\n`,
        );
    const skipped = selected.skipped.map((skip) => `${skip.ref}: ${skip.reason}; no source check applies.\n`);
    return { text: [...text, ...skipped].join(''), json: report, exitCode: report.exitCode };
}
