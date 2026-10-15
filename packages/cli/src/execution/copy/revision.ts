import { GspotError } from '#cli/errors.ts';
import { setImmediate } from 'node:timers/promises';
import { scratchFolder } from '#cli/system/files.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { DIRECTORY_MODE } from '#cli/config/system/modes.ts';
import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { systemSegments } from '#cli/system/safe-folder/names.ts';
import { writeScratchFiles } from '#cli/execution/copy/scratch.ts';
import { packageFiles } from '#cli/repository/dependency-files.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import type { SafeFolder } from '#cli/types/system/safe-folder.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/tools/python.ts';
import { runGit, gitText, gitLine, gitTopLevel } from '#cli/system/git.ts';
import { join, posix, dirname, resolve, basename, relative } from 'node:path';
import type { ScratchFile, DependencyCopy } from '#cli/types/execution/copy.ts';
import { GITLINK_MODE, SYMLINK_MODE } from '#cli/config/repository/revisions.ts';
import { openSafeFolder, walkSafeFolder } from '#cli/system/safe-folder/open.ts';
import { visitGitBlobs, listRevisionEntries } from '#cli/repository/revisions/objects.ts';
import { statSync, chmodSync, lstatSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { DOT_GSPOT, VALE_CONFIG, VALE_PACKAGE_DIRECTORY } from '#cli/config/system/locations.ts';
import { PACKAGE_JSON, PACKAGE_SWIFT, PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';
import { ignoredPaths, copyDependencies, declarationDependencies } from '#cli/execution/copy/dependencies.ts';

import {
    GIT_SET_HEAD,
    GIT_HASH_PATHS,
    GIT_INDEX_INFO,
    GIT_WRITE_TREE,
    GIT_EMPTY_INDEX,
    DEPENDENCY_FILES,
    GIT_SHARED_CLONE,
} from '#cli/config/execution/copy.ts';

// Refuses a copy whose Vale configuration differs from the configuration that selected its installed packages.
function assertValeMatches(installed: SafeFolder, destination: SafeFolder, config: string): void {
    const current = installed.read(config);
    const selected = destination.read(config);
    if (current === undefined || selected === undefined || !current.bytes.equals(selected.bytes))
        throw new GspotError(
            'files',
            'Installed Vale packages do not match the revision configuration. Check this commit in its own clone after running gspot apply and gspot install there.',
        );
}

// Copies one package file the copy lacks through the same confined writer.
function copyPackageFile(installed: SafeFolder, destination: SafeFolder, path: string): void {
    if (destination.read(path) !== undefined) return;
    const content = installed.read(path);
    if (content === undefined)
        throw new GspotError('files', `Installed Vale package file ${path} disappeared. Run gspot apply.`);
    destination.write(path, content, undefined);
}

// The dependency folders the copy's projects own, when the working tree has them installed. Python
// environments stay in place; their tools check the copy's files.
function listDependencyFolders(installed: SafeFolder, projects: string[]): string[] {
    return projects.flatMap((path) => {
        const folder = dirname(path);
        if (basename(path) !== 'package.json') return [];
        return installed.stat(posix.join(folder, NODE_MODULES)) === undefined ? [] : [folder];
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

// Refuses a copy whose manifests or lockfiles differ from the working tree's, which the installation came from.
// Git's clean filters decide the comparison, so a manifest checked out with CRLF matches its LF blob.
async function assertDependencyFilesUnchanged(
    root: string,
    installed: SafeFolder,
    inputs: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const mismatch = new GspotError(
        'files',
        'Installed dependencies do not match the revision manifests and lockfiles or its compiler configurations. Check this commit in its own clone after installing its project dependencies and running gspot install there.',
    );
    if (inputs.some((entry) => statSync(join(root, entry.path), { throwIfNoEntry: false }) === undefined))
        throw mismatch;
    // The confined read refuses a manifest link that leaves the repository before Git follows it.
    for (const entry of inputs) installed.realPath(entry.path);
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
 * Copy installed Vale packages only when the copy retains their installation configuration.
 *
 * @param root the repository root.
 * @param scratch the package-copy destination.
 * @param paths the copy's files, among them the Vale configurations that name packages.
 */
function copyValePackages(root: string, scratch: string, paths: string[]): void {
    const configurations = paths.filter((path) => path === VALE_CONFIG || path.endsWith(`/${VALE_CONFIG}`));
    using installed = openSafeFolder(root);
    using destination = openSafeFolder(resolve(scratch), 'system');
    const packages = listStyleFiles(installed, VALE_PACKAGE_DIRECTORY);
    if (packages.length === 0) return;
    for (const config of configurations) assertValeMatches(installed, destination, config);
    for (const path of packages) copyPackageFile(installed, destination, path);
}

/**
 * Select installed packages after checking the copied project inputs.
 *
 * @param root the repository root.
 * @param scratch the private copy.
 * @param entries Git entries with each project's manifests.
 * @param cancelSignal cancellation for the copy.
 *
 * @returns guarded dependency operations.
 */
async function revisionDependencies(
    root: string,
    scratch: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<DependencyCopy[]> {
    using installed = openSafeFolder(root, 'system');
    const inputs = entries.filter((entry) => {
        const name = basename(entry.path);
        const lockfile = lockfileEntry(name);
        return (
            new Set<string>(DEPENDENCY_FILES).has(name) ||
            name === PACKAGE_SWIFT ||
            (lockfile !== undefined && 'copied' in lockfile)
        );
    });
    const projects = inputs
        .map((entry) => entry.path)
        .filter((path) => new Set<string>(DEPENDENCY_FILES).has(basename(path)));
    const directories = listDependencyFolders(installed, projects);
    const environments = projects
        .filter(
            (path) =>
                basename(path) === PYPROJECT_TOML &&
                installed.stat(posix.join(dirname(path), PYTHON_ENVIRONMENT_FOLDER))?.isDirectory() === true,
        )
        .map((path) => dirname(path));
    const declarations = await declarationDependencies(root, entries, cancelSignal);
    const artifacts = await ignoredPaths(
        root,
        packageFiles(
            root,
            projects.filter((path) => basename(path) === PACKAGE_JSON),
        ),
        cancelSignal,
    );
    const untrackedArtifacts = artifacts.filter((path) => !entries.some((entry) => entry.path === path));
    if (directories.length + environments.length + declarations.copies.length + untrackedArtifacts.length === 0)
        return [];
    for (const folder of directories) assertDependencyReady(scratch, folder);
    await assertDependencyFilesUnchanged(
        root,
        installed,
        [...new Set([...inputs, ...entries.filter(({ path }) => declarations.configurationPaths.has(path))])],
        cancelSignal,
    );
    return [
        ...declarations.copies,
        ...untrackedArtifacts.map((path): DependencyCopy => ({ path, operation: 'clone' })),
        ...directories.map((folder): DependencyCopy => {
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
function caseCollision(entries: GitEntry[]): [string, string] | undefined {
    const seen = new Map<string, string>();
    for (const { path } of entries) {
        const earlier = seen.get(path.toLowerCase());
        if (earlier !== undefined) return [earlier, path];
        seen.set(path.toLowerCase(), path);
    }
    return undefined;
}

async function populateRevision(
    root: string,
    scratch: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const collision = caseCollision(entries);
    const upper = scratch.toUpperCase();
    if (collision !== undefined && upper !== scratch && existsSync(upper))
        throw new GspotError(
            'files',
            `Git holds ${collision[0]} and ${collision[1]}, which differ only by letter case, and this file system keeps one of them. Rename or remove one with git mv or git rm --cached, then check again.`,
        );
    for (const entry of entries.filter((file) => file.mode === GITLINK_MODE)) {
        const target = join(scratch, ...systemSegments(entry.path));
        mkdirSync(target, { recursive: true, mode: DIRECTORY_MODE });
        chmodSync(target, DIRECTORY_MODE);
    }
    // Write links last so no authored link can redirect another tracked write.
    for (const linked of [false, true]) {
        const selected = Map.groupBy(
            entries.flatMap((entry) =>
                entry.mode === GITLINK_MODE || (entry.mode === SYMLINK_MODE) !== linked
                    ? []
                    : [{ ...entry, mode: entry.mode }],
            ),
            (entry) => entry.hash,
        );
        await visitGitBlobs(
            scratch,
            [...selected.keys()],
            async (blobs) => {
                async function* files(): AsyncGenerator<ScratchFile> {
                    for await (const [hash, bytes] of blobs) {
                        for (const entry of selected.get(hash) ?? []) yield { entry, bytes };
                    }
                }
                await writeScratchFiles({ root, target: scratch, files: files(), dependencies: [], cancelSignal });
            },
            cancelSignal,
        );
    }
}

/**
 * Every file under the styles folder, whether it belongs to a Vale package or to the gspot style.
 *
 * @param files the source root of the styles folder.
 * @param folder the emitted or installed style directory.
 *
 * @returns the files, relative to the root.
 */
function listStyleFiles(files: SafeFolder, folder: string): string[] {
    const found: string[] = [];
    walkSafeFolder(files, folder, (path) => {
        if (files.stat(path)?.isDirectory() === true) return true;
        found.push(path);
        return false;
    });
    return found;
}

/**
 * Write Git revision content without checkout filters, stashing, or working-tree writes.
 *
 * @param root repository directory.
 * @param source selected revision.
 * @param action operation using the disposable copy.
 * @param cancelSignal command cancellation.
 *
 * @returns the operation result.
 */
export async function copyRevision<Result>(
    root: string,
    source: Revision,
    action: (scratch: string, tree: string) => Promise<Result>,
    cancelSignal?: AbortSignal,
): Promise<Result> {
    const toplevel = await gitTopLevel(root, { cancelSignal });
    const directory = relative(realpathSync(toplevel), realpathSync(root));
    const entries = await listRevisionEntries(toplevel, source, cancelSignal);
    const index = entries.map((entry) => `${entry.mode} ${entry.hash} 0\t${entry.path}\0`).join('');
    using scratch = scratchFolder();
    await gitText(toplevel, [...GIT_SHARED_CLONE, toplevel, scratch.path], {
        cancelSignal,
    });
    // The clone shares its object store for reads; the copy owns its index and working tree.
    if (source.kind === 'commit') await gitText(scratch.path, [...GIT_SET_HEAD, source.hash], { cancelSignal });
    await gitText(scratch.path, GIT_EMPTY_INDEX, { cancelSignal });
    await gitText(scratch.path, GIT_INDEX_INFO, { cancelSignal, stdin: index });
    const tree = gitLine(await gitText(scratch.path, GIT_WRITE_TREE, { cancelSignal }));
    await populateRevision(toplevel, scratch.path, entries, cancelSignal);
    copyValePackages(
        toplevel,
        scratch.path,
        entries.map((entry) => entry.path),
    );
    const dependencies = await revisionDependencies(toplevel, scratch.path, entries, cancelSignal);
    await copyDependencies({ root: toplevel, target: scratch.path, dependencies, cancelSignal });
    await setImmediate();
    cancelSignal?.throwIfAborted();
    return await action(join(scratch.path, directory), tree);
}
