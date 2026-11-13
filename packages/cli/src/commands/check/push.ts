import { runTreeCheck } from '#cli/commands/check/tree.ts';
import { EMPTY_PUSH_MESSAGE, NO_PENDING_REFS } from '#cli/config/commands/check.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import { readTreeStatus } from '#cli/repository/revisions/changes.ts';
import { readHead } from '#cli/repository/revisions/files.ts';
import { findPushSkipReason, readPushedRevisions } from '#cli/repository/revisions/push.ts';
import { createRunCache } from '#cli/system/cache.ts';
import type { CheckOptions, CleanHead, PushReport, RevisionCheckResult } from '#cli/types/commands.ts';
import type { PushedRevisions, PushRevision } from '#cli/types/repository.ts';
import type { CommandResult } from '#cli/types/system.ts';

async function readCleanHead(
    root: string,
    pushed: PushedRevisions,
    cancelSignal: AbortSignal,
): Promise<CleanHead | undefined> {
    const head = await readHead(root, cancelSignal);
    if (head === undefined || pushed.revisions.every(({ hash }) => hash !== head)) return undefined;
    const { hasStagedChanges, unstaged, untracked } = await readTreeStatus(root, cancelSignal);
    const isClean = !hasStagedChanges && unstaged.length === 0 && untracked.paths.length === 0;
    return isClean ? { hash: head, untracked } : undefined;
}

async function checkRevisionTree(
    root: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
    { revision, cleanHead }: { revision: PushRevision; cleanHead: CleanHead | undefined },
): Promise<RevisionCheckResult> {
    const { hash: commit, base, paths, commits, range, shallow } = revision;
    const selection = { content: 'commit', reference: commit, base, paths, commits, range, shallow } as const;
    if (commit === cleanHead?.hash)
        return await runTreeCheck(root, options, cancelSignal, {
            session: { toolsRoot: root, untracked: cleanHead.untracked },
            selection,
        });
    using copy = await copyRevision(root, { kind: 'commit', hash: commit, paths }, cancelSignal);
    return await runTreeCheck(copy.root, options, cancelSignal, {
        session: { toolsRoot: root, unreadablePaths: copy.unreadablePaths },
        selection,
        ...(copy.dependencyNote !== undefined && { dependencyNote: copy.dependencyNote }),
    });
}

async function runRevisionCheck(
    root: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
    checked: { revision: PushRevision; cleanHead: CleanHead | undefined },
): Promise<RevisionCheckResult | undefined> {
    try {
        const skipped = await findPushSkipReason(root, checked.revision, cancelSignal);
        return skipped === undefined ? await checkRevisionTree(root, options, cancelSignal, checked) : { skipped };
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
    return {
        revisions,
        skipped: pushed.skipped,
        exitCode: Math.max(0, ...revisions.map((revision) => revision.report.exitCode)),
        canceled: cancelSignal.aborted ? { pendingRefs } : null,
    };
}

function formatUncheckedRefs(pushed: PushedRevisions, report: PushReport): string[] {
    const canceled =
        report.canceled === null
            ? []
            : [
                  `Push checks canceled. Branches and tags not checked: ${report.canceled.pendingRefs.join(', ') || NO_PENDING_REFS}.\n`,
              ];
    return [...canceled, ...pushed.skipped.map((skip) => `${skip.ref}: ${skip.reason}; no checks apply.\n`)];
}

export async function runPushCheck(
    root: string,
    options: CheckOptions & { push: NonNullable<CheckOptions['push']> },
    cancelSignal: AbortSignal,
): Promise<CommandResult<PushReport>> {
    const selected = await readPushedRevisions(root, options.push.stdin, options.push.remote, cancelSignal);
    const revisions: PushReport['revisions'] = [];
    const text: string[] = selected.revisions.length === 0 && selected.skipped.length === 0 ? [EMPTY_PUSH_MESSAGE] : [];
    let revisionCount = 0;
    const session = { toolCache: createRunCache(root) };
    const cleanHead = await readCleanHead(root, selected, cancelSignal);
    for (const revision of selected.revisions) {
        const result = await runRevisionCheck(root, { ...options, session }, cancelSignal, { revision, cleanHead });
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
    return {
        text: [...text, ...formatUncheckedRefs(selected, report)].join(''),
        json: report,
        exitCode: report.exitCode,
    };
}
