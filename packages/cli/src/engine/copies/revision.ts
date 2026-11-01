import type { Files } from '#cli/types/system.ts';
import { GspotError } from '#cli/system/errors.ts';
import { setImmediate } from 'node:timers/promises';
import { openFiles } from '#cli/system/files/open.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { writeCopyFiles } from '#cli/engine/copies/files.ts';
import { splitSystemPath } from '#cli/system/files/reads.ts';
import { copyValePackages } from '#cli/engine/copies/vale.ts';
import { LOCKFILES } from '#cli/config/repository/javascript.ts';
import { createCopyFolder } from '#cli/engine/copies/folders.ts';
import type { GitFile, Revision } from '#cli/types/repository.ts';
import { join, posix, dirname, basename, relative } from 'node:path';
import { listPackageFiles } from '#cli/repository/javascript/workspaces.ts';
import { SYMLINK_MODE, GITLINK_MODE } from '#cli/config/repository/files.ts';
import { runGit, readGitText, readGitPaths } from '#cli/repository/git/run.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { PACKAGE_JSON, PACKAGE_SWIFT, PYPROJECT_TOML } from '#cli/config/parsers.ts';
import { visitGitBlobs, listRevisionFiles } from '#cli/repository/revisions/files.ts';
import { statSync, chmodSync, lstatSync, mkdirSync, realpathSync, copyFileSync, writeFileSync } from 'node:fs';
import type { CopyFile, RevisionCopy, CopyIndexFile, RevisionDependencies } from '#cli/types/engine/tool-runs.ts';
import { TRAILING_NEWLINE, GIT_TOP_LEVEL_ARGUMENTS, GIT_DIFF_NAMES_ARGUMENTS } from '#cli/config/repository/git.ts';
import { copyDependencies, readIgnoredPaths, readDeclarationDependencies } from '#cli/engine/copies/dependencies.ts';

import {
    DEPENDENCY_FILES,
    GIT_SHALLOW_PATH,
    GIT_INIT_ARGUMENTS,
    GIT_HASH_ARGUMENTS,
    GIT_PATH_ARGUMENTS,
    GIT_ALTERNATES_PATH,
    OWNER_WRITABLE_FOLDER,
    GIT_SET_HEAD_ARGUMENTS,
    DEPENDENCY_REVISION_NOTE,
    GIT_WRITE_TREE_ARGUMENTS,
    GIT_EMPTY_INDEX_ARGUMENTS,
    GIT_VERIFY_HEAD_ARGUMENTS,
    GIT_HASH_FORMAT_ARGUMENTS,
    GIT_UPDATE_INDEX_ARGUMENTS,
    DECLARATION_CONFIG_EXTENSIONS,
    INSTALLED_DEPENDENCIES_MESSAGE,
} from '#cli/config/engine.ts';

function listDependencyFolders(installed: Files, projects: string[]): string[] {
    return projects.flatMap((path) => {
        const folder = dirname(path);
        if (basename(path) !== PACKAGE_JSON) return [];
        return installed.findStats(posix.join(folder, NODE_MODULES)) === undefined ? [] : [folder];
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

async function listUnchangedDependencies(
    root: string,
    installed: Files,
    indexFiles: GitFile[],
    cancelSignal?: AbortSignal,
): Promise<Set<string>> {
    const present = indexFiles.filter(
        ({ path }) => statSync(join(root, path), { throwIfNoEntry: false })?.isFile() === true,
    );
    for (const indexFile of present) installed.readCanonicalPath(indexFile.path);
    const hashed = await runGit(root, GIT_HASH_ARGUMENTS, {
        stdin: present.map((indexFile) => JSON.stringify(indexFile.path) + '\n').join(''),
        cancelSignal,
    });
    if (hashed.code !== 0)
        throw new GspotError(
            'git',
            `Git cannot hash the working-tree dependency files: ${hashed.stderr.trim()}. Repair the repository before checking this revision.`,
        );
    const hashes = hashed.stdout.trim().split('\n');
    return new Set(present.filter((indexFile, index) => hashes[index] === indexFile.hash).map(({ path }) => path));
}

function listInstalledDependencies(copyRoot: string, folders: string[]): string[] {
    return folders.map((folder) => {
        const path = posix.join(folder, NODE_MODULES);
        if (lstatSync(join(copyRoot, path), { throwIfNoEntry: false }) !== undefined)
            throw new GspotError('copy', INSTALLED_DEPENDENCIES_MESSAGE);
        return path;
    });
}

function needsDependencyNote(selection: { isMismatched: boolean; isInstalled: boolean; changed: GitFile[] }): boolean {
    const { isMismatched, isInstalled, changed } = selection;
    if (isMismatched) return true;
    return isInstalled && changed.length > 0;
}

async function selectRevisionDependencies(
    root: string,
    copyRoot: string,
    indexFiles: GitFile[],
    cancelSignal?: AbortSignal,
): Promise<RevisionDependencies> {
    const installed = openFiles(root);
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
                installed.findStats(posix.join(dirname(path), PYTHON_ENVIRONMENT_FOLDER)) !== undefined,
        )
        .map((path) => dirname(path));
    const unchangedPaths = await listUnchangedDependencies(
        root,
        installed,
        indexFiles.filter(
            (file) => dependencyFiles.includes(file) || DECLARATION_CONFIG_EXTENSIONS.has(extractExtension(file.path)),
        ),
        cancelSignal,
    );
    const declarations = await readDeclarationDependencies(root, indexFiles, unchangedPaths, cancelSignal);
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
    const copied = [...folders, ...declarations.copies, ...untrackedArtifacts];
    const needsNote = needsDependencyNote({
        isMismatched: declarations.mismatched,
        isInstalled: copied.length + environments.length > 0,
        changed: dependencyFiles.filter(({ path }) => !unchangedPaths.has(path)),
    });
    const note = needsNote ? { dependencyNote: DEPENDENCY_REVISION_NOTE } : {};
    if (copied.length === 0) return { dependencies: [], ...note };
    for (const folder of folders) assertDependencyReady(copyRoot, folder);
    const dependencies: string[] = [
        ...declarations.copies,
        ...untrackedArtifacts,
        ...listInstalledDependencies(copyRoot, folders),
    ];
    return { dependencies, ...note };
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

async function listWorkingTreeMatches(
    root: string,
    indexFiles: GitFile[],
    cancelSignal: AbortSignal | undefined,
): Promise<ReadonlySet<GitFile>> {
    const changed = new Set(await readGitPaths(root, GIT_DIFF_NAMES_ARGUMENTS, { cancelSignal }));
    return new Set(
        indexFiles.filter(({ path, mode }) => mode !== GITLINK_MODE && mode !== SYMLINK_MODE && !changed.has(path)),
    );
}

async function writeRevisionFiles(
    root: string,
    copyRoot: string,
    { indexFiles, cloned }: { indexFiles: GitFile[]; cloned: ReadonlySet<GitFile> },
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
    const clonedPaths = [...cloned].map(({ path }) => path);
    await writeCopyFiles({ root, target: copyRoot, files: clonedPaths, dependencies: [], cancelSignal });
    for (const linked of [false, true]) {
        const selected = Map.groupBy(
            indexFiles.filter(
                (indexFile): indexFile is CopyIndexFile =>
                    indexFile.mode !== GITLINK_MODE &&
                    (indexFile.mode === SYMLINK_MODE) === linked &&
                    !cloned.has(indexFile),
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
    writeFileSync(join(copyRoot, GIT_ALTERNATES_PATH), `${gitStoreLine.trim()}\n`);
    const shallowLine = await readGitText(toplevel, [...GIT_PATH_ARGUMENTS, 'shallow'], { cancelSignal });
    const shallow = shallowLine.trim();
    if (statSync(shallow, { throwIfNoEntry: false }) !== undefined)
        copyFileSync(shallow, join(copyRoot, GIT_SHALLOW_PATH));
    const head = await runGit(toplevel, GIT_VERIFY_HEAD_ARGUMENTS, { cancelSignal });
    if (source.kind === 'index' && head.code === 0)
        await readGitText(copyRoot, [...GIT_SET_HEAD_ARGUMENTS, head.stdout.trim()], { cancelSignal });
    if (source.kind === 'commit')
        await readGitText(copyRoot, [...GIT_SET_HEAD_ARGUMENTS, source.hash], { cancelSignal });
}

/**
Writes a Git revision into a private copy and leaves the authored files alone. The copy clones each file that matches
the index from the working tree, and takes every other file from its Git blob. The copy has its own Git directory, so
Git commands use the copied revision.

@param root the checkout with the Git objects and installed dependencies.
@param source the revision to copy.
@param cancelSignal stops the copy.
*/
export async function copyRevision(root: string, source: Revision, cancelSignal?: AbortSignal): Promise<RevisionCopy> {
    const toplevelLine = await readGitText(root, GIT_TOP_LEVEL_ARGUMENTS, { cancelSignal });
    const toplevel = toplevelLine.replace(TRAILING_NEWLINE, '');
    const folder = relative(realpathSync(toplevel), realpathSync(root));
    const unreadablePaths: string[] = [];
    const indexFiles = await listRevisionFiles(toplevel, source, cancelSignal, unreadablePaths);
    const index = indexFiles.map((indexFile) => `${indexFile.mode} ${indexFile.hash} 0\t${indexFile.path}\0`).join('');
    const copy = createCopyFolder(toplevel);
    try {
        await initializeRevisionCopy(toplevel, copy.path, source, cancelSignal);
        await readGitText(copy.path, GIT_EMPTY_INDEX_ARGUMENTS, { cancelSignal });
        await readGitText(copy.path, GIT_UPDATE_INDEX_ARGUMENTS, { cancelSignal, stdin: index });
        const treeLine = await readGitText(copy.path, GIT_WRITE_TREE_ARGUMENTS, { cancelSignal });
        const tree = treeLine.replace(TRAILING_NEWLINE, '');
        const cloned =
            source.kind === 'index'
                ? await listWorkingTreeMatches(toplevel, indexFiles, cancelSignal)
                : new Set<GitFile>();
        await writeRevisionFiles(toplevel, copy.path, { indexFiles, cloned }, cancelSignal);
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
            unreadablePaths,
            root: join(copy.path, folder),
            tree,
            ...(selected.dependencyNote !== undefined && { dependencyNote: selected.dependencyNote }),
        };
    } catch (error) {
        copy[Symbol.dispose]();
        throw error;
    }
}
