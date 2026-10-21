import { GspotError } from '#cli/system/errors.ts';
import { setImmediate } from 'node:timers/promises';
import { openFiles } from '#cli/system/files/open.ts';
import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import type { Files } from '#cli/types/system/files.ts';
import { writeCopyFiles } from '#cli/runs/copy/files.ts';
import { runGit, readGitText } from '#cli/system/git.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { copyValePackages } from '#cli/runs/copy/vale-packages.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import { OWNER_WRITABLE_FOLDER } from '#cli/config/system/modes.ts';
import { listPackageFiles } from '#cli/repository/npm/workspaces.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { join, posix, dirname, basename, relative } from 'node:path';
import { GITLINK_MODE, SYMLINK_MODE } from '#cli/config/parsers/git.ts';
import { statSync, chmodSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { TRAILING_NEWLINE, GIT_TOP_LEVEL_ARGUMENTS } from '#cli/config/system/git.ts';
import type { CopyFile, RevisionCopy, DependencyCopy } from '#cli/types/runs/copy.ts';
import { visitGitBlobs, listRevisionEntries } from '#cli/repository/revisions/files.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/repository/tracked.ts';
import { PACKAGE_JSON, PACKAGE_SWIFT, PYPROJECT_TOML } from '#cli/config/parsers/dependencies.ts';
import { copyDependencies, readIgnoredPaths, readDeclarationDependencies } from '#cli/runs/copy/dependencies.ts';

import {
    DEPENDENCY_FILES,
    GIT_HASH_ARGUMENTS,
    GIT_SET_HEAD_ARGUMENTS,
    GIT_WRITE_TREE_ARGUMENTS,
    GIT_EMPTY_INDEX_ARGUMENTS,
    GIT_SHARED_CLONE_ARGUMENTS,
    GIT_UPDATE_INDEX_ARGUMENTS,
} from '#cli/config/runs/copy.ts';

// Python environments stay in place: UV_PROJECT_ENVIRONMENT and the interpreter flag point the tools at them while
// they check the files of the copy.
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
            'files',
            `${folder} has no lockfile, so gspot cannot tell whether its installed dependencies match this revision. Commit a lockfile.`,
        );
}

// Refuses a copy whose dependency files or lockfiles differ from the working tree, the source of the install.
// The comparison runs through the Git clean filters, so a dependency file checked out with CRLF matches its LF blob.
async function assertDependencyFilesUnchanged(
    root: string,
    installed: Files,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const mismatch = new GspotError(
        'files',
        'Installed dependencies do not match the dependency files and lockfiles of the revision or its compiler configurations. Check this commit in its own clone after installing its project dependencies and running gspot install there.',
    );
    if (entries.some((entry) => statSync(join(root, entry.path), { throwIfNoEntry: false }) === undefined))
        throw mismatch;
    // The confined read refuses a dependency file link that leaves the repository, before Git follows it.
    for (const entry of entries) installed.readRealPath(entry.path);
    const hashed = await runGit(root, GIT_HASH_ARGUMENTS, {
        stdin: entries.map((entry) => `${entry.path}\n`).join(''),
        cancelSignal,
    });
    if (hashed.code !== 0)
        throw new GspotError(
            'git',
            `Git cannot hash the working-tree dependency files: ${hashed.stderr.trim()}. Repair the repository before checking this revision.`,
        );
    const hashes = hashed.stdout.trim().split('\n');
    if (entries.some((entry, index) => hashes[index] !== entry.hash)) throw mismatch;
}

/**
 * Selects installed dependencies to copy, after checking that the dependency files match.
 *
 * @param repositoryRoot the working tree with installed dependencies.
 * @param copyRoot the private copy.
 * @param entries the tracked files of the revision.
 * @param cancelSignal stops the copy.
 * @returns the dependencies to clone or link.
 */
async function selectRevisionDependencies(
    repositoryRoot: string,
    copyRoot: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<DependencyCopy[]> {
    using installed = openFiles(repositoryRoot);
    const inputs = entries.filter((entry) => {
        const name = basename(entry.path);
        const lockfile = LOCKFILES.find((entry) => entry.file === posix.basename(name));
        return DEPENDENCY_FILES.has(name) || name === PACKAGE_SWIFT || (lockfile !== undefined && 'copied' in lockfile);
    });
    const projects = inputs.map((entry) => entry.path).filter((path) => DEPENDENCY_FILES.has(basename(path)));
    const folders = listDependencyFolders(installed, projects);
    const environments = projects
        .filter(
            (path) =>
                basename(path) === PYPROJECT_TOML &&
                installed.readStats(posix.join(dirname(path), PYTHON_ENVIRONMENT_FOLDER))?.isDirectory() === true,
        )
        .map((path) => dirname(path));
    const declarations = await readDeclarationDependencies(repositoryRoot, entries, cancelSignal);
    const artifacts = await readIgnoredPaths(
        repositoryRoot,
        listPackageFiles(
            repositoryRoot,
            projects.filter((path) => basename(path) === PACKAGE_JSON),
        ),
        cancelSignal,
    );
    const tracked = new Set(entries.map(({ path }) => path));
    const untrackedArtifacts = artifacts.filter((path) => !tracked.has(path));
    if (folders.length + environments.length + declarations.copies.length + untrackedArtifacts.length === 0) return [];
    for (const folder of folders) assertDependencyReady(copyRoot, folder);
    await assertDependencyFilesUnchanged(
        repositoryRoot,
        installed,
        [...new Set([...inputs, ...entries.filter(({ path }) => declarations.configurationPaths.has(path))])],
        cancelSignal,
    );
    return [
        ...declarations.copies,
        ...untrackedArtifacts.map((path): DependencyCopy => ({ path, operation: 'clone' })),
        ...folders.map((folder): DependencyCopy => {
            const path = posix.join(folder, NODE_MODULES);
            if (lstatSync(join(copyRoot, path), { throwIfNoEntry: false }) !== undefined)
                throw new GspotError(
                    'files',
                    'Installed dependencies are tracked in the selected revision. Untrack them before checking again.',
                );
            return { path, operation: basename(folder) === DOT_GSPOT ? 'link' : 'clone' };
        }),
    ];
}

// Two tracked paths that differ only by letter case, or undefined when every path folds to its own spelling.
function findCaseCollision(entries: GitEntry[]): [string, string] | undefined {
    const seen = new Map<string, string>();
    for (const { path } of entries) {
        const earlier = seen.get(path.toLowerCase());
        if (earlier !== undefined) return [earlier, path];
        seen.set(path.toLowerCase(), path);
    }
    return undefined;
}

async function writeRevisionFiles(
    root: string,
    copyRoot: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const collision = findCaseCollision(entries);
    const upper = copyRoot.toUpperCase();
    if (collision !== undefined && upper !== copyRoot && statSync(upper, { throwIfNoEntry: false }) !== undefined)
        throw new GspotError(
            'files',
            `Git holds ${collision[0]} and ${collision[1]}, which differ only by letter case, and this file system keeps one of them. Rename or remove one with git mv or git rm --cached, then check again.`,
        );
    for (const entry of entries.filter((file) => file.mode === GITLINK_MODE)) {
        const target = join(copyRoot, ...splitSystemPath(entry.path));
        mkdirSync(target, { recursive: true, mode: OWNER_WRITABLE_FOLDER });
        chmodSync(target, OWNER_WRITABLE_FOLDER);
    }
    // Write links last so no authored link can redirect another tracked write.
    for (const linked of [false, true]) {
        const selected = Map.groupBy(
            entries.flatMap<Exclude<CopyFile, string>['entry']>((entry) =>
                entry.mode === GITLINK_MODE || (entry.mode === SYMLINK_MODE) !== linked
                    ? []
                    : [{ ...entry, mode: entry.mode }],
            ),
            (entry) => entry.hash,
        );
        await visitGitBlobs(
            copyRoot,
            [...selected.keys()],
            async (blobs) => {
                async function* listBlobFiles(): AsyncGenerator<CopyFile> {
                    for await (const [hash, bytes] of blobs) {
                        for (const entry of selected.get(hash) ?? []) yield { entry, bytes };
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

/**
 * Writes a Git revision into a copy without checkout filters, stashing, or working-tree writes.
 *
 * @param repositoryRoot the checkout with the Git objects and installed dependencies.
 * @param source the revision to copy.
 * @param cancelSignal stops the copy.
 * @returns the disposable source copy and its Git tree.
 */
export async function copyRevision(
    repositoryRoot: string,
    source: Revision,
    cancelSignal?: AbortSignal,
): Promise<RevisionCopy> {
    const toplevelLine = await readGitText(repositoryRoot, GIT_TOP_LEVEL_ARGUMENTS, { cancelSignal });
    const toplevel = toplevelLine.replace(TRAILING_NEWLINE, '');
    const folder = relative(realpathSync(toplevel), realpathSync(repositoryRoot));
    const entries = await listRevisionEntries(toplevel, source, cancelSignal);
    const index = entries.map((entry) => `${entry.mode} ${entry.hash} 0\t${entry.path}\0`).join('');
    const copy = createTemporaryFolder();
    try {
        await readGitText(toplevel, [...GIT_SHARED_CLONE_ARGUMENTS, toplevel, copy.path], {
            cancelSignal,
        });
        // The clone shares its object store for reads; the copy owns its index and working tree.
        if (source.kind === 'commit')
            await readGitText(copy.path, [...GIT_SET_HEAD_ARGUMENTS, source.hash], { cancelSignal });
        await readGitText(copy.path, GIT_EMPTY_INDEX_ARGUMENTS, { cancelSignal });
        await readGitText(copy.path, GIT_UPDATE_INDEX_ARGUMENTS, { cancelSignal, stdin: index });
        const treeLine = await readGitText(copy.path, GIT_WRITE_TREE_ARGUMENTS, { cancelSignal });
        const tree = treeLine.replace(TRAILING_NEWLINE, '');
        await writeRevisionFiles(toplevel, copy.path, entries, cancelSignal);
        copyValePackages(
            toplevel,
            copy.path,
            entries.map((entry) => entry.path),
        );
        const dependencies = await selectRevisionDependencies(toplevel, copy.path, entries, cancelSignal);
        await copyDependencies({ root: toplevel, target: copy.path, dependencies, cancelSignal });
        await setImmediate();
        cancelSignal?.throwIfAborted();
        return { ...copy, root: join(copy.path, folder), tree };
    } catch (error) {
        copy[Symbol.dispose]();
        throw error;
    }
}
