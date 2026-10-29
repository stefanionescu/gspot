import { GspotError } from '#cli/system/errors.ts';
import { INDEX_LINE } from '#cli/config/parsers/git.ts';
import type { GitFile } from '#cli/types/parsers/git.ts';
import { listGitFiles } from '#cli/repository/files/tracked.ts';
import { gitIndexFileSchema } from '#cli/schemas/parsers/git.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import { runGit, runGitStream, runGitForBytes } from '#cli/system/git.ts';
import { GIT_INDEX_FILES_ARGUMENTS } from '#cli/config/repository/files/tracked.ts';
import { parseGitBlobs, parseTreeFiles, parseListingLine, stripIndexStages } from '#cli/parsers/git.ts';

import {
    GIT_HEAD_ARGUMENTS,
    GIT_BLOBS_ARGUMENTS,
    GIT_LS_TREE_ARGUMENTS,
    UNREADABLE_HISTORY_MESSAGE,
    GIT_SYMBOLIC_HEAD_ARGUMENTS,
} from '#cli/config/repository/revisions/files.ts';

/**
Read complete index or tree entries without Git path quoting. Reject unresolved conflicts.

@param root the folder where Git runs.
@param source index or commit to inspect.
@param cancelSignal stops the command.
@param unreadablePaths receives names with invalid UTF-8.
*/
export async function listRevisionFiles(
    root: string,
    source: Revision,
    cancelSignal?: AbortSignal,
    unreadablePaths: string[] = [],
): Promise<GitFile[]> {
    if (source.kind === 'index')
        return stripIndexStages(
            await listGitFiles(root, GIT_INDEX_FILES_ARGUMENTS, cancelSignal, unreadablePaths).then((listed) =>
                listed
                    .split('\0')
                    .filter(Boolean)
                    .map((line) => parseListingLine(INDEX_LINE.exec(line), gitIndexFileSchema)),
            ),
        );
    const read = await runGitForBytes(root, [...GIT_LS_TREE_ARGUMENTS, source.hash], { cancelSignal });
    if (read.code !== 0)
        throw new GspotError(
            'git',
            `Git could not read the entries of this revision: ${read.stderr.trim()}. Resolve Git errors before checking again.`,
        );
    return parseTreeFiles(read.stdout, unreadablePaths);
}

/**
Read each raw blob once, and visit it before the next blob loads.

@param root the folder where Git runs.
@param requested full blob object IDs.
@param visit reads one validated object.
@param cancelSignal stops the command.
*/
export async function visitGitBlobs(
    root: string,
    requested: string[],
    visit: (blobs: AsyncIterable<readonly [string, Buffer]>) => Promise<void>,
    cancelSignal?: AbortSignal,
): Promise<void> {
    const blobs = [...new Set(requested)];
    if (blobs.length === 0) return;
    const result = await runGitStream(
        root,
        GIT_BLOBS_ARGUMENTS,
        {
            stdin: blobs.join('\n') + '\n',
            cancelSignal,
        },
        async (chunks) => {
            await visit(parseGitBlobs(chunks, blobs));
        },
    );
    if (result.code !== 0)
        throw new GspotError('git', `Git could not read the objects of this revision: ${result.stderr.trim()}`);
}

/**
Collect the validated blobs.

@param root the folder where Git runs.
@param requested full blob object IDs.
@param cancelSignal stops the command.
*/
export async function readBlobs(root: string, requested: string[], cancelSignal?: AbortSignal): Promise<Buffer[]> {
    const blobs = new Map<string, Buffer>();
    await visitGitBlobs(
        root,
        requested,
        async (stream) => {
            for await (const [hash, bytes] of stream) blobs.set(hash, bytes);
        },
        cancelSignal,
    );
    return requested.map((hash) => blobs.get(hash) as Buffer);
}

/**
Read the current commit, distinguishing an unborn branch from failed Git reads.

@param root the folder where Git runs.
@param cancelSignal stops the command.
@returns undefined for an unborn branch.
*/
export async function readHead(root: string, cancelSignal?: AbortSignal): Promise<string | undefined> {
    const options = { cancelSignal };
    const head = await runGit(root, GIT_HEAD_ARGUMENTS, options);
    if (head.code === 0) return head.stdout.trim();
    const failure = new GspotError('git', UNREADABLE_HISTORY_MESSAGE);
    if (head.code !== 1) throw failure;
    const symbolic = await runGit(root, GIT_SYMBOLIC_HEAD_ARGUMENTS, options);
    if (symbolic.code !== 0) throw failure;
    return undefined;
}
