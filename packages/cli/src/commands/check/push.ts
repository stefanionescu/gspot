import { readGitLines } from '#cli/repository/git/run.ts';
import { runTreeCheck } from '#cli/commands/check/tree.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import { SETTINGS_FILE } from '#cli/config/settings/settings.ts';
import { readPushedRevisions } from '#cli/repository/revisions/push.ts';
import { NO_PENDING_REFS, EMPTY_PUSH_MESSAGE } from '#cli/config/commands/check.ts';
import { type PushRevision, type PushedRevisions } from '#cli/types/repository/revisions.ts';
import { type PushReport, type CheckOptions, type RevisionCheckResult } from '#cli/types/commands/check.ts';

async function runRevisionCheck(
    root: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
    revision: PushRevision,
): Promise<RevisionCheckResult | undefined> {
    if (revision.paths?.length === 0) return { skipped: 'no changed paths' };
    try {
        const settings = await readGitLines(root, ['ls-tree', '--name-only', revision.hash, '--', SETTINGS_FILE], {
            cancelSignal,
        });
        if (settings.length === 0) return { skipped: 'the commit has no gspot.toml' };
        using copy = await copyRevision(root, { kind: 'commit', hash: revision.hash }, cancelSignal);
        return await runTreeCheck(copy.root, options, cancelSignal, {
            ...(copy.dependencyNote !== undefined && { dependencyNote: copy.dependencyNote }),
            unreadablePaths: copy.unreadablePaths,
            base: revision.base,
            commits: revision.commits,
            range: revision.range,
            shallow: revision.shallow,
            content: 'commit',
            toolsRoot: root,
            reference: revision.hash,
            ...(revision.paths !== undefined && { changed: revision.paths }),
        });
    } catch (error) {
        if (!cancelSignal.aborted) throw error;
        return undefined;
    }
}

function buildPushReport(
    pushed: PushedRevisions,
    revisions: PushReport['revisions'],
    cancelSignal: AbortSignal,
    revisionCount: number,
): PushReport {
    const pendingRefs = pushed.revisions.slice(revisionCount).flatMap((revision) => revision.refs);
    const exitCode = cancelSignal.aborted
        ? Number(cancelSignal.reason)
        : Math.max(0, ...revisions.map((revision) => revision.report.exitCode));
    return {
        revisions,
        skipped: pushed.skipped,
        exitCode,
        ...(cancelSignal.aborted && { canceled: { pendingRefs } }),
    };
}

/**
Check each revision that the pre-push input names, each in a copy.

@param root the working tree that gives the settings and gets the push report.
@param options the parsed flags, with the pre-push input.
@param cancelSignal stops the run.
*/
export async function runPushCheck(
    root: string,
    options: CheckOptions & { push: NonNullable<CheckOptions['push']> },
    cancelSignal: AbortSignal,
): Promise<CommandResult<PushReport>> {
    const selected = await readPushedRevisions(root, options.push.stdin, options.push.remote, cancelSignal);
    const revisions: PushReport['revisions'] = [];
    const text: string[] = selected.revisions.length === 0 && selected.skipped.length === 0 ? [EMPTY_PUSH_MESSAGE] : [];
    let revisionCount = 0;
    for (const revision of selected.revisions) {
        const result = await runRevisionCheck(root, options, cancelSignal, revision);
        if (result === undefined) break;
        revisionCount += 1;
        if ('skipped' in result) {
            selected.skipped.push(
                ...revision.refs.map((ref) => ({ ref, hash: revision.hash, reason: result.skipped })),
            );
            continue;
        }
        revisions.push({
            hash: revision.hash,
            refs: revision.refs,
            commits: revision.commits,
            shallow: revision.shallow,
            report: result.json,
        });
        text.push(`${revision.refs.join(', ')} at ${revision.hash}\n${result.text}`);
    }
    const report = buildPushReport(selected, revisions, cancelSignal, revisionCount);
    if (report.canceled !== undefined)
        text.push(
            `Push checks canceled. Branches and tags not checked: ${report.canceled.pendingRefs.join(', ') || NO_PENDING_REFS}.\n`,
        );
    const skipped = selected.skipped.map((skip) => `${skip.ref}: ${skip.reason}; no checks apply.\n`);
    return { text: [...text, ...skipped].join(''), json: report, exitCode: report.exitCode };
}
