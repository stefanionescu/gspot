// Attach the original tool installation to a read-only revision copy.
import pLimit from 'p-limit';
import { runGit } from '#cli/platform/git.ts';
import { statSync, constants } from 'node:fs';
import { isInside } from '#cli/platform/paths.ts';
import { listStyleFiles } from '#cli/tools/vale.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { Root } from '#cli/types/platform/root.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import { isValePackageFile } from '#cli/repository/kind.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { getOwnership } from '#cli/lifecycle/ownership/log.ts';
import { DOT_GSPOT, VALE_CONFIG } from '#cli/config/platform/locations.ts';
import { MODE_BITS, PRIVATE_DIRECTORY } from '#cli/config/platform/modes.ts';
import { join, posix, dirname, basename, relative, isAbsolute } from 'node:path';
import type { RevisionRoots, DependencyFolder } from '#cli/types/execution/copy.ts';
import { CLONE_OPTIONS, COPY_CONCURRENCY, PROJECT_MANIFESTS } from '#cli/config/execution/copy.ts';
import { cp, stat, chmod, lstat, mkdir, unlink, readdir, symlink, readlink, realpath } from 'node:fs/promises';

// Checks one copied link. Some links point at files the revision does not track, such as the build output of a
// workspace package. Such a link resolves only in the working tree, and nothing in the revision can run it, so it is
// removed. A link that is broken in the working tree too, or that leaves the copy, is refused.
async function assertLink(roots: RevisionRoots, path: string): Promise<void> {
    const resolved = await realpath(path).catch(() => undefined);
    const target =
        resolved ?? (await realpath(join(roots.working, relative(roots.revision, path))).catch(() => undefined));
    if (target === undefined)
        throw new GspotError('selection', [
            `Installed dependency link ${relative(roots.revision, path)} cannot be resolved. Repair the dependency installation before checking this revision.`,
        ]);
    const inside = relative(resolved === undefined ? roots.working : roots.revision, target);
    if (!isInside(inside))
        throw new GspotError('selection', [
            `Installed dependency link ${relative(roots.revision, path)} leaves the repository. Prepare isolated dependencies for this revision.`,
        ]);
    if (resolved === undefined) await unlink(path);
}

async function assertLinks(roots: RevisionRoots, directory: string, cancelSignal?: AbortSignal): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        cancelSignal?.throwIfAborted();
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await assertLinks(roots, path, cancelSignal);
        else if (entry.isSymbolicLink()) await assertLink(roots, path);
    }
}

function assertDependencyReady(checkout: string, folder: string, pending: string[]): void {
    if (basename(folder) === DOT_GSPOT && pending.includes('npm'))
        throw new GspotError('selection', [
            'Tool installation is incomplete. Run gspot install before checking this revision.',
        ]);
    if (
        !LOCKFILES.some(
            (lockfile) =>
                'snapshot' in lockfile &&
                (statSync(join(checkout, folder, lockfile.file), { throwIfNoEntry: false }) !== undefined ||
                    statSync(join(checkout, lockfile.file), { throwIfNoEntry: false }) !== undefined),
        )
    )
        throw new GspotError('selection', [
            `${folder} has no lockfile, so gspot cannot tell whether its installed dependencies match this revision. Commit a lockfile.`,
        ]);
}

// Refuses a copy whose Vale configuration differs from the one the packages were installed for.
function assertValeMatches(installed: Root, destination: Root): void {
    const current = installed.read(VALE_CONFIG);
    const selected = destination.read(VALE_CONFIG);
    if (current === undefined || selected === undefined || !current.bytes.equals(selected.bytes))
        throw new GspotError('selection', [
            'Installed Vale packages do not match the revision configuration. Prepare this revision separately and run gspot apply.',
        ]);
}

// Copies one package file the copy lacks.
function copyPackageFile(installed: Root, destination: Root, path: string): void {
    if (destination.read(path) !== undefined) return;
    const content = installed.read(path);
    if (content === undefined)
        throw new GspotError('selection', [`Installed Vale package file ${path} disappeared. Run gspot apply.`]);
    destination.write(path, content, undefined);
}

// The dependency folders the copy's projects own, when the working tree has them installed. Python
// environments are not copied: their tools run in place, against the copy's files.
function getDependencies(installed: Root, projects: string[]): DependencyFolder[] {
    return projects.flatMap((path) => {
        const folder = dirname(path);
        const dependency = basename(path) === 'package.json' ? 'node_modules' : '.venv';
        return installed.stat(posix.join(folder, dependency)) === undefined ? [] : [{ folder, dependency }];
    });
}

// Refuses a copy whose manifests or lockfiles differ from the working tree's, which the installation came from.
// Git's clean filters decide the comparison, so a manifest checked out with CRLF matches its LF blob.
async function assertManifestsUnchanged(
    root: string,
    installed: Root,
    inputs: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const mismatch = new GspotError('selection', [
        'Installed dependencies do not match the revision manifests and lockfiles. Prepare this revision in a separate worktree and run gspot install.',
    ]);
    if (inputs.some((entry) => statSync(join(root, entry.path), { throwIfNoEntry: false }) === undefined))
        throw mismatch;
    // The confined read refuses a manifest link that leaves the repository before Git follows it.
    for (const entry of inputs) installed.assertInside(entry.path);
    const hashed = await runGit(root, ['hash-object', '--stdin-paths'], {
        stdin: inputs.map((entry) => `${entry.path}\n`).join(''),
        cancelSignal,
    });
    if (hashed.code !== 0)
        throw new GspotError('selection', [
            `Git cannot hash the working-tree manifests: ${hashed.stderr.trim()}. Repair the repository before checking this revision.`,
        ]);
    const hashes = hashed.stdout.trim().split('\n');
    if (inputs.some((entry, index) => hashes[index] !== entry.hash)) throw mismatch;
}

// A link to a directory keeps its type in the copy: a generic copy makes a file link, which Windows cannot follow.
async function copyDirectoryLink(source: string, target: string): Promise<boolean> {
    const entry = await lstat(source);
    if (!entry.isSymbolicLink()) return false;
    const linkTarget = await readlink(source);
    const resolved = await stat(source).catch(() => undefined);
    if (resolved?.isDirectory() !== true) return false;
    await symlink(linkTarget, target, isAbsolute(linkTarget) ? 'junction' : 'dir');
    return true;
}

// Copies one dependency tree into the copy with the mode of its source, draining every child before returning.
async function copyTree(source: string, target: string, cancelSignal?: AbortSignal): Promise<void> {
    const sourceStat = await stat(source);
    await mkdir(target, { mode: PRIVATE_DIRECTORY });
    const copy = pLimit(COPY_CONCURRENCY);
    const children = await readdir(source);
    // Each child has its own destination. Drain every copy before cleanup or link validation.
    const copied = await Promise.allSettled(
        children.map((name) =>
            copy(async () => {
                cancelSignal?.throwIfAborted();
                if (await copyDirectoryLink(join(source, name), join(target, name))) return;
                await cp(join(source, name), join(target, name), {
                    ...CLONE_OPTIONS,
                    mode: constants.COPYFILE_FICLONE,
                    filter: () => {
                        cancelSignal?.throwIfAborted();
                        return true;
                    },
                });
            }),
        ),
    );
    for (const result of copied) if (result.status === 'rejected') throw result.reason;
    await chmod(target, sourceStat.mode & MODE_BITS);
}

// Copies one package folder into the copy. The tool projects of gspot run in place, like its Python environment:
// the manifest and lockfile guard has matched them, and no check writes into them.
async function copyDependency(
    root: string,
    checkout: string,
    { folder, dependency }: DependencyFolder,
    cancelSignal?: AbortSignal,
): Promise<void> {
    const isToolProject = basename(folder) === DOT_GSPOT;
    const pending = isToolProject ? (getOwnership(join(root, dirname(folder))).installing ?? []) : [];
    assertDependencyReady(checkout, folder, pending);
    const source = join(root, folder, dependency);
    const target = join(checkout, folder, dependency);
    if (statSync(target, { throwIfNoEntry: false }) !== undefined)
        throw new GspotError('selection', [
            'Installed dependencies are tracked in the selected revision. Untrack them before checking again.',
        ]);
    const kind = process.platform === 'win32' ? 'junction' : 'dir';
    await (isToolProject ? symlink(source, target, kind) : copyTree(source, target, cancelSignal));
}

/**
 * Copy the installed Vale packages into a copy whose Vale configuration matches the one they were synced for.
 * @param root the repository root
 * @param checkout the copy directory the packages are copied into
 * @param paths the copy's files, among them the Vale configurations that name packages
 */
export function copyValePackages(root: string, checkout: string, paths: string[]): void {
    const configurations = paths.filter((path) => path === VALE_CONFIG || path.endsWith(`/${VALE_CONFIG}`));
    for (const config of configurations) {
        const folder = config.slice(0, -VALE_CONFIG.length);
        using installed = openRoot(join(root, folder));
        using destination = openRoot(join(checkout, folder));
        const packages = listStyleFiles(installed).filter((path) => isValePackageFile(path));
        if (packages.length === 0) continue;
        assertValeMatches(installed, destination);
        for (const path of packages) copyPackageFile(installed, destination, path);
    }
}

/**
 * Copy the installed package trees the copy's projects own, after checking that their inputs match.
 * @param root the repository root
 * @param checkout the copy directory the dependencies are copied into
 * @param entries the copy's Git entries, among them the project manifests that own dependencies
 * @param cancelSignal cancellation for the copy
 */
export async function copyInstalledDependencies(
    root: string,
    checkout: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    using installed = openRoot(root, 'native');
    const inputs = entries.filter((entry) => {
        const name = basename(entry.path);
        const lockfile = lockfileEntry(name);
        return (
            PROJECT_MANIFESTS.includes(name) ||
            name === 'Package.swift' ||
            (lockfile !== undefined && 'snapshot' in lockfile)
        );
    });
    const projects = inputs.map((entry) => entry.path).filter((path) => PROJECT_MANIFESTS.includes(basename(path)));
    const directories = getDependencies(installed, projects);
    if (directories.length === 0) return;
    await assertManifestsUnchanged(root, installed, inputs, cancelSignal);
    const nodeModules = directories.filter((directory) => directory.dependency === 'node_modules');
    for (const directory of nodeModules) await copyDependency(root, checkout, directory, cancelSignal);
    // The copy root is compared in its resolved spelling, which a Windows temp path shortens.
    const roots = { revision: await realpath(checkout), working: await realpath(root) };
    for (const { folder, dependency } of nodeModules.filter((directory) => basename(directory.folder) !== DOT_GSPOT))
        await assertLinks(roots, join(roots.revision, folder, dependency), cancelSignal);
}
