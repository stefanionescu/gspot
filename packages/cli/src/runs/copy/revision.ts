import { GspotError } from '#cli/system/errors.ts';
import { setImmediate } from 'node:timers/promises';
import { openFiles } from '#cli/system/files/open.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import type { Files } from '#cli/types/system/files.ts';
import { writeCopyFiles } from '#cli/runs/copy/files.ts';
import { runGit, readGitText } from '#cli/system/git.ts';
import type { GitFile } from '#cli/types/parsers/git.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { DEPENDENCY_FILES } from '#cli/config/runs/copy/files.ts';
import { copyValePackages } from '#cli/runs/copy/vale-packages.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import { listPackageFiles } from '#cli/repository/npm/workspaces.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { join, posix, dirname, basename, relative } from 'node:path';
import { SYMLINK_MODE, GITLINK_MODE } from '#cli/config/files/modes.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import { TRAILING_NEWLINE, GIT_TOP_LEVEL_ARGUMENTS } from '#cli/config/system/git.ts';
import { visitGitBlobs, listRevisionFiles } from '#cli/repository/revisions/files.ts';
import { PACKAGE_JSON, PACKAGE_SWIFT, PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';
import { statSync, chmodSync, lstatSync, mkdirSync, realpathSync, copyFileSync, writeFileSync } from 'node:fs';
import { copyDependencies, readIgnoredPaths, readDeclarationDependencies } from '#cli/runs/copy/dependencies.ts';

import type {
    CopyFile,
    RevisionCopy,
    CopyIndexFile,
    DependencyCopy,
    RevisionDependencies,
} from '#cli/types/runs/copy.ts';
import {
    GIT_INIT_ARGUMENTS,
    GIT_HASH_ARGUMENTS,
    GIT_PATH_ARGUMENTS,
    OWNER_WRITABLE_FOLDER,
    GIT_SET_HEAD_ARGUMENTS,
    DEPENDENCY_REVISION_NOTE,
    GIT_WRITE_TREE_ARGUMENTS,
    GIT_EMPTY_INDEX_ARGUMENTS,
    GIT_VERIFY_HEAD_ARGUMENTS,
    GIT_HASH_FORMAT_ARGUMENTS,
    GIT_UPDATE_INDEX_ARGUMENTS,
} from '#cli/config/runs/copy/revision.ts';

function listDependencyFolders(installed: Files, projects: string[]): string[] {
    return projects.flatMap((path) => {
        const folder = dirname(path);
        if (basename(path) !== PACKAGE_JSON) return [];
        return installed.readStats(posix.join(folder, NODE_MODULES)) === undefined ? [] : [folder];
    });
}

function assertDependencyReady(copyRoot: string, folder: string): void {
    if (
        !LOCKFILES.some(
            (lockfile) =>
                'copied' in lockfile &&
                (statSync(join(copyRoot, folder, lockfile.file), { throwIfNoEntry: false }) !== undefined ||
                    statSync(join(copyRoot, lockfile.file), { throwIfNoEntry: false }) !== undefined),
        )
    )
        throw new GspotError(
            'copy',
            `${folder} has no lockfile, so gspot cannot tell whether its installed dependencies match this revision. Commit a lockfile.`,
        );
}

async function areDependencyFilesUnchanged(
    root: string,
    installed: Files,
    indexFiles: GitFile[],
    cancelSignal?: AbortSignal,
): Promise<boolean> {
    if (indexFiles.some((indexFile) => statSync(join(root, indexFile.path), { throwIfNoEntry: false }) === undefined))
        return false;
    for (const indexFile of indexFiles) installed.readCanonicalPath(indexFile.path);
    const hashed = await runGit(root, GIT_HASH_ARGUMENTS, {
        stdin: indexFiles.map((indexFile) => `${indexFile.path}\n`).join(''),
        cancelSignal,
    });
    if (hashed.code !== 0)
        throw new GspotError(
            'git',
            `Git cannot hash the working-tree dependency files: ${hashed.stderr.trim()}. Repair the repository before checking this revision.`,
        );
    const hashes = hashed.stdout.trim().split('\n');
    return indexFiles.every((indexFile, index) => hashes[index] === indexFile.hash);
}

function listInstalledDependencies(copyRoot: string, folders: string[]): DependencyCopy[] {
    return folders.map((folder) => {
        const path = posix.join(folder, NODE_MODULES);
        if (lstatSync(join(copyRoot, path), { throwIfNoEntry: false }) !== undefined)
            throw new GspotError(
                'copy',
                'Installed dependencies are tracked in the selected revision. Untrack them before checking again.',
            );
        return { path, operation: basename(folder) === DOT_GSPOT ? 'link' : 'clone' };
    });
}

async function selectRevisionDependencies(
    root: string,
    copyRoot: string,
    indexFiles: GitFile[],
    cancelSignal?: AbortSignal,
): Promise<RevisionDependencies> {
    using installed = openFiles(root);
    const dependencyFiles = indexFiles.filter((indexFile) => {
        const name = basename(indexFile.path);
        const lockfile = LOCKFILES.find((each) => each.file === name);
        return DEPENDENCY_FILES.has(name) || name === PACKAGE_SWIFT || (lockfile !== undefined && 'copied' in lockfile);
    });
    const projects = dependencyFiles.map(({ path }) => path).filter((path) => DEPENDENCY_FILES.has(basename(path)));
    const folders = listDependencyFolders(installed, projects);
    const environments = projects
        .filter(
            (path) =>
                basename(path) === PYPROJECT_TOML &&
                installed.readStats(posix.join(dirname(path), PYTHON_ENVIRONMENT_FOLDER))?.isDirectory() === true,
        )
        .map((path) => dirname(path));
    const declarations = await readDeclarationDependencies(root, indexFiles, cancelSignal);
    const artifacts = await readIgnoredPaths(
        root,
        listPackageFiles(
            root,
            projects.filter((path) => basename(path) === PACKAGE_JSON),
        ),
        cancelSignal,
    );
    const tracked = new Set(indexFiles.map(({ path }) => path));
    const untrackedArtifacts = artifacts.filter((path) => !tracked.has(path));
    if (folders.length + environments.length + declarations.copies.length + untrackedArtifacts.length === 0)
        return { dependencies: [] };
    for (const folder of folders) assertDependencyReady(copyRoot, folder);
    const matches = await areDependencyFilesUnchanged(
        root,
        installed,
        [
            ...new Set([
                ...dependencyFiles,
                ...indexFiles.filter(({ path }) => declarations.configurationPaths.has(path)),
            ]),
        ],
        cancelSignal,
    );
    const dependencies: DependencyCopy[] = [
        ...declarations.copies,
        ...untrackedArtifacts.map((path): DependencyCopy => ({ path, operation: 'clone' })),
        ...listInstalledDependencies(copyRoot, folders),
    ];
    return matches ? { dependencies } : { dependencies, dependencyNote: DEPENDENCY_REVISION_NOTE };
}

function findCaseCollision(indexFiles: GitFile[]): [string, string] | undefined {
    const seen = new Map<string, string>();
    for (const { path } of indexFiles) {
        const earlier = seen.get(path.toLowerCase());
        if (earlier !== undefined) return [earlier, path];
        seen.set(path.toLowerCase(), path);
    }
    return undefined;
}

async function writeRevisionFiles(
    root: string,
    copyRoot: string,
    indexFiles: GitFile[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const collision = findCaseCollision(indexFiles);
    const upper = copyRoot.toUpperCase();
    if (collision !== undefined && upper !== copyRoot && statSync(upper, { throwIfNoEntry: false }) !== undefined)
        throw new GspotError(
            'copy',
            `Git holds ${collision[0]} and ${collision[1]}, which differ only by letter case, and this file system keeps one of them. Rename or remove one with git mv or git rm --cached, then check again.`,
        );
    for (const indexFile of indexFiles) {
        if (indexFile.mode !== GITLINK_MODE) continue;
        const target = join(copyRoot, ...splitSystemPath(indexFile.path));
        mkdirSync(target, { recursive: true, mode: OWNER_WRITABLE_FOLDER });
        chmodSync(target, OWNER_WRITABLE_FOLDER);
    }
    for (const linked of [false, true]) {
        const selected = Map.groupBy(
            indexFiles.filter(
                (indexFile): indexFile is CopyIndexFile =>
                    indexFile.mode !== GITLINK_MODE && (indexFile.mode === SYMLINK_MODE) === linked,
            ),
            (indexFile) => indexFile.hash,
        );
        await visitGitBlobs(
            copyRoot,
            selected.keys().toArray(),
            async (blobs) => {
                async function* listBlobFiles(): AsyncGenerator<CopyFile> {
                    for await (const [hash, bytes] of blobs) {
                        const files = selected.get(hash) ?? [];
                        for (const indexFile of files) yield { indexFile, bytes };
                    }
                }
                await writeCopyFiles({
                    root,
                    target: copyRoot,
                    files: listBlobFiles(),
                    dependencies: [],
                    cancelSignal,
                });
            },
            cancelSignal,
        );
    }
}

async function initializeRevisionCopy(
    toplevel: string,
    copyRoot: string,
    source: Revision,
    cancelSignal: AbortSignal | undefined,
): Promise<void> {
    const formatLine = await readGitText(toplevel, GIT_HASH_FORMAT_ARGUMENTS, { cancelSignal });
    await readGitText(copyRoot, [...GIT_INIT_ARGUMENTS, `--object-format=${formatLine.trim()}`, copyRoot], {
        cancelSignal,
    });
    const gitStoreLine = await readGitText(toplevel, [...GIT_PATH_ARGUMENTS, 'objects'], { cancelSignal });
    writeFileSync(join(copyRoot, '.git/objects/info/alternates'), `${gitStoreLine.trim()}\n`);
    const shallowLine = await readGitText(toplevel, [...GIT_PATH_ARGUMENTS, 'shallow'], { cancelSignal });
    const shallow = shallowLine.trim();
    if (statSync(shallow, { throwIfNoEntry: false }) !== undefined)
        copyFileSync(shallow, join(copyRoot, '.git/shallow'));
    const head = await runGit(toplevel, GIT_VERIFY_HEAD_ARGUMENTS, { cancelSignal });
    if (source.kind === 'index' && head.code === 0)
        await readGitText(copyRoot, [...GIT_SET_HEAD_ARGUMENTS, head.stdout.trim()], { cancelSignal });
    if (source.kind === 'commit')
        await readGitText(copyRoot, [...GIT_SET_HEAD_ARGUMENTS, source.hash], { cancelSignal });
}

/**
Writes a Git revision into a copy without checkout filters, stashing, or working-tree writes.

@param root the checkout with the Git objects and installed dependencies.
@param source the revision to copy.
@param cancelSignal stops the copy.
@returns the temporary copy, the folder of the repository inside it, and the tree hash of the copied index.
*/
export async function copyRevision(root: string, source: Revision, cancelSignal?: AbortSignal): Promise<RevisionCopy> {
    const toplevelLine = await readGitText(root, GIT_TOP_LEVEL_ARGUMENTS, { cancelSignal });
    const toplevel = toplevelLine.replace(TRAILING_NEWLINE, '');
    const folder = relative(realpathSync(toplevel), realpathSync(root));
    const indexFiles = await listRevisionFiles(toplevel, source, cancelSignal);
    const index = indexFiles.map((indexFile) => `${indexFile.mode} ${indexFile.hash} 0\t${indexFile.path}\0`).join('');
    const copy = createTemporaryFolder();
    try {
        await initializeRevisionCopy(toplevel, copy.path, source, cancelSignal);
        await readGitText(copy.path, GIT_EMPTY_INDEX_ARGUMENTS, { cancelSignal });
        await readGitText(copy.path, GIT_UPDATE_INDEX_ARGUMENTS, { cancelSignal, stdin: index });
        const treeLine = await readGitText(copy.path, GIT_WRITE_TREE_ARGUMENTS, { cancelSignal });
        const tree = treeLine.replace(TRAILING_NEWLINE, '');
        await writeRevisionFiles(toplevel, copy.path, indexFiles, cancelSignal);
        copyValePackages(
            toplevel,
            copy.path,
            indexFiles.map((indexFile) => indexFile.path),
        );
        const selected = await selectRevisionDependencies(toplevel, copy.path, indexFiles, cancelSignal);
        await copyDependencies({
            root: toplevel,
            target: copy.path,
            dependencies: selected.dependencies,
            cancelSignal,
        });
        await setImmediate();
        cancelSignal?.throwIfAborted();
        return {
            ...copy,
            root: join(copy.path, folder),
            tree,
            ...(selected.dependencyNote !== undefined && { dependencyNote: selected.dependencyNote }),
        };
    } catch (error) {
        copy[Symbol.dispose]();
        throw error;
    }
}
