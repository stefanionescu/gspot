import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { GIT_INDEX_FILES_ARGUMENTS, GITLINK_MODE, SYMLINK_MODE } from '#cli/config/repository/files.ts';
import { INDEX_LINE, TRAILING_NEWLINE, TREE_LINE } from '#cli/config/repository/git.ts';
import {
    CRLF_INDEX_LINE,
    GIT_BLOBS_ARGUMENTS,
    GIT_CHANGED_PATHS_ARGUMENTS,
    GIT_COMMITTED_PATHS_ARGUMENTS,
    GIT_HEAD_ARGUMENTS,
    GIT_LINE_ENDINGS_ARGUMENTS,
    GIT_LS_TREE_ARGUMENTS,
    GIT_SETUP_FILES_ARGUMENTS,
    GIT_SHALLOW_ARGUMENTS,
    GIT_SYMBOLIC_HEAD_ARGUMENTS,
    GIT_WRITE_TREE_ARGUMENTS,
    PRIVATE_INDEX_FILE,
    READ_COMMITTED_MESSAGE,
    SETUP_PATHS,
    UNREADABLE_HISTORY_MESSAGE,
} from '#cli/config/repository/revisions.ts';
import { decodeGitPaths, parseGitBlobs, parseListingLine, stripIndexStages } from '#cli/repository/git/output.ts';
import { readGitPath, readGitPaths, readGitText, runGit, runGitBytes } from '#cli/repository/git/run.ts';
import { gitFileSchema, gitIndexFileSchema } from '#cli/schemas/repository.ts';
import { GspotError } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { getRequired } from '#cli/system/tables.ts';
import type { GitFile, Revision } from '#cli/types/repository.ts';

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
    return decodeGitPaths(read.stdout, unreadablePaths).map((line) =>
        parseListingLine(TREE_LINE.exec(line), gitFileSchema),
    );
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
        { stdin: `${hashes.join('\n')}\n`, cancelSignal },
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
export async function writeIndexTree(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const indexPath = await readGitPath(root, 'index', cancelSignal);
    using folder = createTemporaryFolder();
    const privateIndex = join(folder.path, PRIVATE_INDEX_FILE);
    copyFileSync(indexPath, privateIndex);
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

/**
List the tracked paths among `paths` whose working-tree and index contents match HEAD. An unborn history has none.
*/
export async function listCommittedPaths(root: string, paths: string[]): Promise<Set<string>> {
    if ((await readHead(root)) === undefined) return new Set();
    const [tracked, changed] = await Promise.all([
        runGitBytes(root, [...GIT_COMMITTED_PATHS_ARGUMENTS, ...paths], {}),
        runGitBytes(root, [...GIT_CHANGED_PATHS_ARGUMENTS, ...paths], {}),
    ]);
    if (tracked.code !== 0 || changed.code !== 0) throw new GspotError('git', READ_COMMITTED_MESSAGE);
    const modified = new Set(decodeGitPaths(changed.stdout));
    return new Set(decodeGitPaths(tracked.stdout).filter((path) => !modified.has(path)));
}

export async function isShallowClone(root: string, cancelSignal?: AbortSignal): Promise<boolean> {
    const answer = await readGitText(root, GIT_SHALLOW_ARGUMENTS, { cancelSignal });
    return answer.trim() === 'true';
}

/**
List the setup paths, gspot.toml and the .gspot folder, that exist on disk and hold no file in the index.
*/
export async function listUnstagedSetupPaths(root: string, cancelSignal: AbortSignal): Promise<string[]> {
    const indexed = await readGitPaths(root, GIT_SETUP_FILES_ARGUMENTS, { cancelSignal });
    return SETUP_PATHS.filter(
        (path) => existsSync(join(root, path)) && indexed.every((file) => !file.startsWith(path)),
    );
}
