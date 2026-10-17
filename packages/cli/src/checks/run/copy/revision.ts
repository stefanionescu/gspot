import { GspotError } from '#cli/system/errors.ts';
import { setImmediate } from 'node:timers/promises';
import type { Files } from '#cli/types/system/files.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { findLockfile } from '#cli/repository/classify.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { listPackageFiles } from '#cli/tools/npm/packages.ts';
import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import { writeScratchFiles } from '#cli/checks/run/copy/scratch.ts';
import { GIT_TOP_LEVEL_ARGUMENTS } from '#cli/config/system/git.ts';
import { OWNER_WRITABLE_FOLDER } from '#cli/config/system/modes.ts';
import { runGit, readGitText, trimGitLine } from '#cli/system/git.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/tools/python.ts';
import { join, posix, dirname, resolve, basename, relative } from 'node:path';
import { GITLINK_MODE, SYMLINK_MODE } from '#cli/config/repository/revisions.ts';
import type { ScratchFile, DependencyCopy } from '#cli/types/checks/run/copy.ts';
import { statSync, chmodSync, lstatSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { visitGitBlobs, listRevisionEntries } from '#cli/repository/revisions/tree-entries.ts';
import { DOT_GSPOT, VALE_PACKAGES_PATH, VALE_TOOL_FILE_PATH } from '#cli/config/system/locations.ts';
import { PACKAGE_JSON, PACKAGE_SWIFT, PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';
import { readIgnoredPaths, copyDependencies, readDeclarationDependencies } from '#cli/checks/run/copy/dependencies.ts';

import {
    GIT_SET_HEAD,
    GIT_HASH_PATHS,
    GIT_WRITE_TREE,
    GIT_EMPTY_INDEX,
    DEPENDENCY_FILES,
    GIT_SHARED_CLONE,
    GIT_UPDATE_INDEX,
} from '#cli/config/checks/run/copy.ts';

// Refuses a copy whose Vale configuration differs from the one the installed packages came from.
function assertValeMatches(installed: Files, destination: Files, config: string): void {
    const current = installed.read(config);
    const selected = destination.read(config);
    if (current === undefined || selected === undefined || !current.bytes.equals(selected.bytes))
        throw new GspotError(
            'files',
            'Installed Vale packages do not match the revision configuration. Check this commit in its own clone after running gspot apply and gspot install there.',
        );
}

function copyPackageFile(installed: Files, destination: Files, path: string): void {
    if (destination.read(path) !== undefined) return;
    const content = installed.read(path);
    if (content === undefined)
        throw new GspotError('files', `Installed Vale package file ${path} disappeared. Run gspot apply.`);
    destination.write(path, content, undefined);
}

// Python environments stay in place; their tools check the files of the scratch copy.
function listDependencyFolders(installed: Files, projects: string[]): string[] {
    return projects.flatMap((path) => {
        const folder = dirname(path);
        if (basename(path) !== PACKAGE_JSON) return [];
        return installed.readStats(posix.join(folder, NODE_MODULES)) === undefined ? [] : [folder];
    });
}

function assertDependencyReady(scratch: string, folder: string): void {
    if (
        !LOCKFILES.some(
            (lockfile) =>
                'copied' in lockfile &&
                (statSync(join(scratch, folder, lockfile.file), { throwIfNoEntry: false }) !== undefined ||
                    statSync(join(scratch, lockfile.file), { throwIfNoEntry: false }) !== undefined),
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
    inputs: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const mismatch = new GspotError(
        'files',
        'Installed dependencies do not match the revision manifests and lockfiles or its compiler configurations. Check this commit in its own clone after installing its project dependencies and running gspot install there.',
    );
    if (inputs.some((entry) => statSync(join(root, entry.path), { throwIfNoEntry: false }) === undefined))
        throw mismatch;
    // The confined read refuses a dependency file link that leaves the repository, before Git follows it.
    for (const entry of inputs) installed.readRealPath(entry.path);
    const hashed = await runGit(root, GIT_HASH_PATHS, {
        stdin: inputs.map((entry) => `${entry.path}\n`).join(''),
        cancelSignal,
    });
    if (hashed.code !== 0)
        throw new GspotError(
            'git',
            `Git cannot hash the working-tree manifests: ${hashed.stderr.trim()}. Repair the repository before checking this revision.`,
        );
    const hashes = hashed.stdout.trim().split('\n');
    if (inputs.some((entry, index) => hashes[index] !== entry.hash)) throw mismatch;
}

/**
 * Copies the installed Vale packages when the scratch copy keeps the Vale configuration they came from.
 * @param repositoryRoot the repository with the installed packages.
 * @param scratch where to copy the packages.
 * @param paths the files of the scratch copy.
 */
function copyValePackages(repositoryRoot: string, scratch: string, paths: string[]): void {
    const configurations = paths.filter(
        (path) => path === VALE_TOOL_FILE_PATH || path.endsWith(`/${VALE_TOOL_FILE_PATH}`),
    );
    using installed = openFiles(repositoryRoot);
    using destination = openFiles(resolve(scratch));
    const packages = listStyleFiles(installed, VALE_PACKAGES_PATH);
    if (packages.length === 0) return;
    for (const config of configurations) assertValeMatches(installed, destination, config);
    for (const path of packages) copyPackageFile(installed, destination, path);
}

/**
 * Selects installed dependencies to copy, after checking that the dependency files match.
 * @param repositoryRoot the working tree with installed dependencies.
 * @param scratch the private copy.
 * @param entries the tracked files of the revision.
 * @param cancelSignal stops the copy.
 * @returns the dependencies to clone or link.
 */
async function selectRevisionDependencies(
    repositoryRoot: string,
    scratch: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<DependencyCopy[]> {
    using installed = openFiles(repositoryRoot);
    const inputs = entries.filter((entry) => {
        const name = basename(entry.path);
        const lockfile = findLockfile(name);
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
    const untrackedArtifacts = artifacts.filter((path) => !entries.some((entry) => entry.path === path));
    if (folders.length + environments.length + declarations.copies.length + untrackedArtifacts.length === 0) return [];
    for (const folder of folders) assertDependencyReady(scratch, folder);
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
            if (lstatSync(join(scratch, path), { throwIfNoEntry: false }) !== undefined)
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
    scratch: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const collision = findCaseCollision(entries);
    const upper = scratch.toUpperCase();
    if (collision !== undefined && upper !== scratch && existsSync(upper))
        throw new GspotError(
            'files',
            `Git holds ${collision[0]} and ${collision[1]}, which differ only by letter case, and this file system keeps one of them. Rename or remove one with git mv or git rm --cached, then check again.`,
        );
    for (const entry of entries.filter((file) => file.mode === GITLINK_MODE)) {
        const target = join(scratch, ...splitSystemPath(entry.path));
        mkdirSync(target, { recursive: true, mode: OWNER_WRITABLE_FOLDER });
        chmodSync(target, OWNER_WRITABLE_FOLDER);
    }
    // Write links last so no authored link can redirect another tracked write.
    for (const linked of [false, true]) {
        const selected = Map.groupBy(
            entries.flatMap((entry) =>
                entry.mode === GITLINK_MODE || (entry.mode === SYMLINK_MODE) !== linked
                    ? []
                    : [{ ...entry, mode: entry.mode } as const],
            ),
            (entry) => entry.hash,
        );
        await visitGitBlobs(
            scratch,
            [...selected.keys()],
            async (blobs) => {
                async function* listBlobFiles(): AsyncGenerator<ScratchFile> {
                    for await (const [hash, bytes] of blobs) {
                        for (const entry of selected.get(hash) ?? []) yield { entry, bytes };
                    }
                }
                await writeScratchFiles({
                    root,
                    target: scratch,
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
 * List every file under the styles folder: the Vale packages and the gspot style.
 * @param files the source root of the styles folder.
 * @param folder the styles path to walk.
 * @returns the files, relative to the root.
 */
function listStyleFiles(files: Files, folder: string): string[] {
    const found: string[] = [];
    walkFiles(files, folder, (path) => {
        if (files.readStats(path)?.isDirectory() === true) return true;
        found.push(path);
        return false;
    });
    return found;
}

/**
 * Writes a Git revision into a scratch copy without checkout filters, stashing, or working-tree writes.
 * @param repositoryRoot the checkout with the Git objects and installed dependencies.
 * @param source the revision to copy.
 * @param action what to run in the scratch copy.
 * @param cancelSignal stops the copy.
 * @returns what action returns.
 */
export async function copyRevision<Result>(
    repositoryRoot: string,
    source: Revision,
    action: (scratch: string, tree: string) => Promise<Result>,
    cancelSignal?: AbortSignal,
): Promise<Result> {
    const toplevel = trimGitLine(await readGitText(repositoryRoot, GIT_TOP_LEVEL_ARGUMENTS, { cancelSignal }));
    const folder = relative(realpathSync(toplevel), realpathSync(repositoryRoot));
    const entries = await listRevisionEntries(toplevel, source, cancelSignal);
    const index = entries.map((entry) => `${entry.mode} ${entry.hash} 0\t${entry.path}\0`).join('');
    using scratch = createScratchFolder();
    await readGitText(toplevel, [...GIT_SHARED_CLONE, toplevel, scratch.path], {
        cancelSignal,
    });
    // The clone shares its object store for reads; the copy owns its index and working tree.
    if (source.kind === 'commit') await readGitText(scratch.path, [...GIT_SET_HEAD, source.hash], { cancelSignal });
    await readGitText(scratch.path, GIT_EMPTY_INDEX, { cancelSignal });
    await readGitText(scratch.path, GIT_UPDATE_INDEX, { cancelSignal, stdin: index });
    const tree = trimGitLine(await readGitText(scratch.path, GIT_WRITE_TREE, { cancelSignal }));
    await writeRevisionFiles(toplevel, scratch.path, entries, cancelSignal);
    copyValePackages(
        toplevel,
        scratch.path,
        entries.map((entry) => entry.path),
    );
    const dependencies = await selectRevisionDependencies(toplevel, scratch.path, entries, cancelSignal);
    await copyDependencies({ root: toplevel, target: scratch.path, dependencies, cancelSignal });
    await setImmediate();
    cancelSignal?.throwIfAborted();
    return await action(join(scratch.path, folder), tree);
}
