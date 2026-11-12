import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

import { GIT_INDEX_FILES_ARGUMENTS, GITLINK_MODE, SYMLINK_MODE } from '#cli/config/repository/files.ts';
import {
    GIT_BLOBS_ARGUMENTS,
    GIT_HEAD_ARGUMENTS,
    GIT_LS_TREE_ARGUMENTS,
    GIT_SHALLOW_ARGUMENTS,
    GIT_SYMBOLIC_HEAD_ARGUMENTS,
    GIT_WRITE_TREE_ARGUMENTS,
    INDEX_LINE,
    TRAILING_NEWLINE,
    UNREADABLE_HISTORY_MESSAGE,
} from '#cli/config/repository/git.ts';
import { parseGitBlobs, parseListingLine, parseTreeFiles, stripIndexStages } from '#cli/repository/git/output.ts';
import { readGitPaths, readGitText, runGit, runGitBytes } from '#cli/repository/git/run.ts';
import { gitIndexFileSchema } from '#cli/schemas/repository.ts';
import { GspotError } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { getRequired } from '#cli/system/tables.ts';
import type { GitFile, Revision } from '#cli/types/repository.ts';

const GIT_INDEX_PATH_ARGUMENTS = ['rev-parse', '--path-format=absolute', '--git-path', 'index'] as const;

const PRIVATE_INDEX_FILE = 'index';

const GIT_LINE_ENDINGS_ARGUMENTS = ['ls-files', '--eol', '-z'] as const;

const CRLF_INDEX_LINE = /^i\/(?:crlf|mixed)\s/u;

export async function listRevisionFiles(
    root: string,
    source: Revision,
    cancelSignal?: AbortSignal,
    unreadablePaths: string[] = [],
): Promise<GitFile[]> {
    if (source.kind === 'index') {
        const listed = await readGitPaths(root, GIT_INDEX_FILES_ARGUMENTS, { cancelSignal }, unreadablePaths);
        return stripIndexStages(listed.map((line) => parseListingLine(INDEX_LINE.exec(line), gitIndexFileSchema)));
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
List the files whose index blob holds CRLF line endings, which `* text=auto eol=lf` turns to LF only after
`git add --renormalize .`.
*/
export async function listCrlfIndexPaths(root: string, cancelSignal?: AbortSignal): Promise<string[]> {
    const records = await readGitPaths(root, GIT_LINE_ENDINGS_ARGUMENTS, { cancelSignal });
    return records
        .filter((record) => CRLF_INDEX_LINE.test(record))
        .map((record) => record.slice(record.indexOf('\t') + 1));
}

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
    if (files.length === 0) return new Map();
    const hashes = [...new Set(files.map((file) => file.hash))];
    const blobs = new Map<string, Buffer>();
    const result = await runGit(
        root,
        GIT_BLOBS_ARGUMENTS,
        { stdin: hashes.join('\n') + '\n', cancelSignal },
        async (chunks) => {
            for await (const [hash, bytes] of parseGitBlobs(chunks, hashes)) blobs.set(hash, bytes);
        },
    );
    if (result.code !== 0)
        throw new GspotError('git', `Git could not read the objects of this revision: ${result.stderr.trim()}`);
    return new Map(files.map((file) => [file.path, getRequired(blobs, file.hash, 'blob').toString('utf8')]));
}

/**
Write the tree of the index through a private copy of the index file. `git write-tree` locks the index it writes,
so a copy keeps `.git/index.lock` free for the user's `git add` or `git commit` beside the check.
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

export async function isShallowClone(root: string, cancelSignal?: AbortSignal): Promise<boolean> {
    const answer = await readGitText(root, GIT_SHALLOW_ARGUMENTS, { cancelSignal });
    return answer.trim() === 'true';
}
