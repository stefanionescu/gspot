import { join } from 'node:path';
import { copyFileSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { getRequired } from '#cli/system/tables.ts';
import { gitIndexFileSchema } from '#cli/schemas/repository.ts';
import { readGitListing } from '#cli/repository/files/tracked.ts';
import type { GitFile, Revision } from '#cli/types/repository.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { SYMLINK_MODE, GITLINK_MODE, GIT_INDEX_FILES_ARGUMENTS } from '#cli/config/repository/files.ts';
import { parseGitBlobs, parseTreeFiles, parseListingLine, stripIndexStages } from '#cli/repository/git/output.ts';
import { runGit, readGitText, runGitBytes, readGitLines, readGitPaths } from '#cli/repository/git/run.ts';

import {
    INDEX_LINE,
    TRAILING_NEWLINE,
    GIT_HEAD_ARGUMENTS,
    GIT_BLOBS_ARGUMENTS,
    GIT_LS_TREE_ARGUMENTS,
    GIT_WRITE_TREE_ARGUMENTS,
    UNREADABLE_HISTORY_MESSAGE,
    GIT_SYMBOLIC_HEAD_ARGUMENTS,
} from '#cli/config/repository/git.ts';

const GIT_INDEX_PATH_ARGUMENTS = ['rev-parse', '--path-format=absolute', '--git-path', 'index'] as const;

const PRIVATE_INDEX_FILE = 'index';

const GIT_BLOB_SIZES_ARGUMENTS = ['cat-file', '--batch-check=%(objectname) %(objectsize)'] as const;

const BLOB_SIZE = /^\d+$/u;

const BLOB_SIZE_FIELDS = 2;

const GIT_LINE_ENDINGS_ARGUMENTS = ['ls-files', '--eol', '-z'] as const;

const CRLF_INDEX_LINE = /^i\/(?:crlf|mixed)\s/u;

/**
Collect the validated blobs.

@param root the folder where Git runs.
@param requested full blob object IDs.
@param cancelSignal stops the command.
*/
async function readBlobs(root: string, requested: string[], cancelSignal?: AbortSignal): Promise<Buffer[]> {
    const blobs = new Map<string, Buffer>();
    await visitGitBlobs(
        root,
        requested,
        async (stream) => {
            for await (const [hash, bytes] of stream) blobs.set(hash, bytes);
        },
        cancelSignal,
    );
    return requested.map((hash) => getRequired(blobs, hash, 'blob'));
}

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
    if (source.kind === 'index') {
        const listed = await readGitListing(root, GIT_INDEX_FILES_ARGUMENTS, cancelSignal, unreadablePaths);
        return stripIndexStages(
            listed
                .split('\0')
                .filter(Boolean)
                .map((line) => parseListingLine(INDEX_LINE.exec(line), gitIndexFileSchema)),
        );
    }
    const read = await runGitBytes(root, [...GIT_LS_TREE_ARGUMENTS, source.hash], { cancelSignal });
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
    const result = await runGit(
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
Read the size of each blob with one Git process.

@param root the folder where Git runs.
@param hashes full blob object IDs.
@param cancelSignal stops the command.
@returns the size of each blob that Git holds, by object ID.
*/
export async function readBlobSizes(
    root: string,
    hashes: string[],
    cancelSignal?: AbortSignal,
): Promise<Map<string, number>> {
    const requested = [...new Set(hashes)];
    if (requested.length === 0) return new Map();
    const lines = await readGitLines(root, GIT_BLOB_SIZES_ARGUMENTS, {
        cancelSignal,
        stdin: `${requested.join('\n')}\n`,
    });
    return new Map(
        lines.flatMap((line): Array<[string, number]> => {
            const [hash = '', size = ''] = line.split(' ', BLOB_SIZE_FIELDS);
            return BLOB_SIZE.test(size) ? [[hash, Number(size)]] : [];
        }),
    );
}

/**
List the files whose index blob holds CRLF line endings, which `* text=auto eol=lf` turns to LF only after
`git add --renormalize .`.

@param root the folder where Git runs.
@param cancelSignal stops the command.
*/
export async function listCrlfIndexPaths(root: string, cancelSignal?: AbortSignal): Promise<string[]> {
    const records = await readGitPaths(root, GIT_LINE_ENDINGS_ARGUMENTS, { cancelSignal });
    return records
        .filter((record) => CRLF_INDEX_LINE.test(record))
        .map((record) => record.slice(record.indexOf('\t') + 1));
}

/**
Read the committed text of regular files at a revision.

@param root the folder where Git runs.
@param paths the files to read.
@param revision the commit to read, or `HEAD`.
@param cancelSignal stops the command.
@returns the text of each file that the revision holds, by path. An unborn branch holds none.
*/
export async function readCommittedTexts(
    root: string,
    paths: string[],
    revision: string,
    cancelSignal?: AbortSignal,
): Promise<Map<string, string>> {
    const commit = revision === 'HEAD' ? await readHead(root, cancelSignal) : revision;
    if (commit === undefined) return new Map();
    const selected = new Set(paths);
    const committed = await listRevisionFiles(root, { kind: 'commit', hash: commit }, cancelSignal);
    const files = committed.filter(
        (file) => selected.has(file.path) && file.mode !== SYMLINK_MODE && file.mode !== GITLINK_MODE,
    );
    const blobs = await readBlobs(
        root,
        files.map((file) => file.hash),
        cancelSignal,
    );
    return new Map(files.map((file, index) => [file.path, (blobs[index] as Buffer).toString('utf8')]));
}

/**
Write the tree of the index through a private copy of the index file. `git write-tree` locks the index it writes,
so a copy keeps `.git/index.lock` free for the user's `git add` or `git commit` beside the check.

@param root the folder where Git runs.
@param cancelSignal stops the Git commands.
@returns the tree hash.
*/
export async function readIndexTree(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const indexPath = await readGitText(root, GIT_INDEX_PATH_ARGUMENTS, { cancelSignal });
    using folder = createTemporaryFolder();
    const privateIndex = join(folder.path, PRIVATE_INDEX_FILE);
    copyFileSync(indexPath.replace(TRAILING_NEWLINE, ''), privateIndex);
    const tree = await readGitText(root, GIT_WRITE_TREE_ARGUMENTS, {
        cancelSignal,
        env: { GIT_INDEX_FILE: privateIndex },
    });
    return tree.replace(TRAILING_NEWLINE, '');
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
