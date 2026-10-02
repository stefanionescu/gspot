import pLimit from 'p-limit';
import { run } from '#cli/platform/spawn.ts';
import { statSync, constants } from 'node:fs';
import { styleFiles } from '#cli/tools/vale.ts';
import type { Root } from '#cli/types/platform.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { isValePackageFile } from '#cli/repository/kind.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import type { GitEntry, Directory } from '#cli/types/repository/revisions.ts';
import { MODE_BITS, GSPOT_FOLDER, PRIVATE_DIRECTORY } from '#cli/config/platform.ts';
import { sep, join, posix, dirname, basename, relative, isAbsolute } from 'node:path';
import { LOCKS, COPY_CONCURRENCY, VALE_CONFIGURATION } from '#cli/config/repository/revisions.ts';
import { cp, stat, chmod, lstat, mkdir, unlink, readdir, symlink, readlink, realpath } from 'node:fs/promises';

const MANIFESTS = new Set(['package.json', 'pyproject.toml', 'Package.swift', ...LOCKS]);

// Checks one copied link. Some links point at files the revision does not track, such as the build output of a
// workspace package. Such a link resolves only in the working tree, and nothing in the revision can run it, so it is
// removed. A link that is broken in the working tree too, or that leaves the copy, is refused.
async function checkCopiedLink(roots: { revision: string; working: string }, path: string): Promise<void> {
    const resolved = await realpath(path).catch(() => undefined);
    const target =
        resolved ?? (await realpath(join(roots.working, relative(roots.revision, path))).catch(() => undefined));
    if (target === undefined)
        throw new GspotError('selection', [
            `Installed dependency link ${relative(roots.revision, path)} cannot be resolved. Repair the dependency installation before checking this revision.`,
        ]);
    const inside = relative(resolved === undefined ? roots.working : roots.revision, target);
    if (isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`))
        throw new GspotError('selection', [
            'Installed dependencies contain an external link. Prepare isolated dependencies for the selected revision.',
        ]);
    if (resolved === undefined) await unlink(path);
}

async function validateCopiedLinks(
    roots: { revision: string; working: string },
    directory: string,
    cancelSignal?: AbortSignal,
): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        cancelSignal?.throwIfAborted();
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await validateCopiedLinks(roots, path, cancelSignal);
        else if (entry.isSymbolicLink()) await checkCopiedLink(roots, path);
    }
}

function assertDependencyReady(revisionRoot: string, folder: string, pending: string[]): void {
    if (basename(folder) === '.gspot' && pending.includes('npm'))
        throw new GspotError('selection', [
            'Tool installation is incomplete. Run gspot install before checking staged content.',
        ]);
    if (
        !LOCKS.some((lock) => statSync(join(revisionRoot, folder, lock), { throwIfNoEntry: false }) !== undefined) &&
        !LOCKS.some((lock) => statSync(join(revisionRoot, lock), { throwIfNoEntry: false }) !== undefined)
    )
        throw new GspotError('selection', [
            'A revision dependency project has no lock to verify its installed environment. Prepare locked dependencies for this revision.',
        ]);
}

// Refuses a snapshot whose Vale configuration differs from the one the packages were installed for.
function assertSameValeConfiguration(installed: Root, destination: Root): void {
    const current = installed.read(VALE_CONFIGURATION);
    const selected = destination.read(VALE_CONFIGURATION);
    if (current === undefined || selected === undefined || !current.bytes.equals(selected.bytes))
        throw new GspotError('selection', [
            'Installed Vale packages do not match the revision configuration. Prepare this revision separately and run gspot apply.',
        ]);
}

// Copies one package file the snapshot lacks.
function copyPackageFile(installed: Root, destination: Root, path: string): void {
    if (destination.read(path) !== undefined) return;
    const content = installed.read(path);
    if (content === undefined)
        throw new GspotError('selection', [`Installed Vale package file ${path} disappeared. Run gspot apply.`]);
    destination.write(path, content, undefined);
}

// The dependency folders the snapshot's projects own, when the working tree has them installed. Python
// environments are not copied: their tools run in place, against the snapshot's files.
function dependencyDirectories(installed: Root, projects: string[]): Directory[] {
    return projects.flatMap((path) => {
        const folder = dirname(path);
        const dependency = basename(path) === 'package.json' ? 'node_modules' : '.venv';
        return installed.stat(posix.join(folder, dependency)) === undefined ? [] : [{ folder, dependency }];
    });
}

// Refuses a snapshot whose manifests or locks differ from the working tree's, which the installation came from.
// Git's clean filters decide the comparison, so a manifest checked out with CRLF matches its LF blob.
async function assertManifestsUnchanged(
    root: string,
    installed: Root,
    inputs: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const mismatch = new GspotError('selection', [
        'Installed dependencies do not match the revision manifests and locks. Prepare this revision in a separate worktree and run gspot install.',
    ]);
    if (inputs.some((entry) => statSync(join(root, entry.path), { throwIfNoEntry: false }) === undefined))
        throw mismatch;
    // The confined read refuses a manifest link that leaves the repository before Git follows it.
    for (const entry of inputs) installed.source(entry.path);
    const hashed = await run(['git', 'hash-object', '--stdin-paths'], {
        cwd: root,
        stdin: inputs.map((entry) => `${entry.path}\n`).join(''),
        timeoutMs: 30_000,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (hashed.code !== 0)
        throw new GspotError('selection', [
            `Git cannot hash the working-tree manifests: ${hashed.stderr.trim()}. Repair the repository before checking this revision.`,
        ]);
    const hashes = hashed.stdout.trim().split('\n');
    if (inputs.some((entry, index) => hashes[index] !== entry.hash)) throw mismatch;
}

// Copies one dependency tree into the snapshot with the mode of its source, draining every child before returning.

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
                    recursive: true,
                    verbatimSymlinks: true,
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

// Copies one package folder into the snapshot. The private tools of gspot run in place, like its Python environment:
// the manifest and lock guard has matched them, and no check writes into them.
async function copyDirectory(
    root: string,
    revisionRoot: string,
    { folder, dependency }: Directory,
    cancelSignal?: AbortSignal,
): Promise<void> {
    const isPrivate = basename(folder) === GSPOT_FOLDER;
    const pending = isPrivate ? (readOwnership(join(root, dirname(folder))).installations ?? []) : [];
    assertDependencyReady(revisionRoot, folder, pending);
    const source = join(root, folder, dependency);
    const target = join(revisionRoot, folder, dependency);
    if (statSync(target, { throwIfNoEntry: false }) !== undefined)
        throw new GspotError('selection', [
            'Installed dependencies are tracked in the selected revision. Untrack them before checking the index.',
        ]);
    const kind = process.platform === 'win32' ? 'junction' : 'dir';
    await (isPrivate ? symlink(source, target, kind) : copyTree(source, target, cancelSignal));
}

/**
 * Copy the installed Vale packages into a snapshot whose Vale configuration matches the one they were synced for.
 * @param root the repository root
 * @param revisionRoot the snapshot directory the packages are copied into
 * @param paths the snapshot's files, among them the Vale configurations that name packages
 */
export function copyProsePackages(root: string, revisionRoot: string, paths: string[]): void {
    const configs = paths.filter((path) => path === VALE_CONFIGURATION || path.endsWith(`/${VALE_CONFIGURATION}`));
    for (const config of configs) {
        const folder = dirname(dirname(dirname(config)));
        const installed = openRoot(join(root, folder));
        const destination = openRoot(join(revisionRoot, folder));
        try {
            const packages = styleFiles(installed).filter((path) => isValePackageFile(path));
            if (packages.length === 0) continue;
            assertSameValeConfiguration(installed, destination);
            for (const path of packages) copyPackageFile(installed, destination, path);
        } finally {
            installed.close();
            destination.close();
        }
    }
}

/**
 * Copy the installed package trees the snapshot's projects own, after checking that their inputs match.
 * @param root the repository root
 * @param revisionRoot the snapshot directory the dependencies are copied into
 * @param entries the snapshot's Git entries, among them the project manifests that own dependencies
 * @param cancelSignal cancellation for the copy
 */
export async function copyDependencies(
    root: string,
    revisionRoot: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const installed = openRoot(root, 'native');
    try {
        const inputs = entries.filter((entry) => MANIFESTS.has(basename(entry.path)));
        const projects = inputs
            .map((entry) => entry.path)
            .filter((path) => ['package.json', 'pyproject.toml'].includes(basename(path)));
        const directories = dependencyDirectories(installed, projects);
        if (directories.length === 0) return;
        await assertManifestsUnchanged(root, installed, inputs, cancelSignal);
        const packages = directories.filter((directory) => directory.dependency === 'node_modules');
        for (const directory of packages) await copyDirectory(root, revisionRoot, directory, cancelSignal);
        // The snapshot root is compared in its resolved spelling, which a Windows temp path shortens.
        const roots = { revision: await realpath(revisionRoot), working: await realpath(root) };
        for (const { folder, dependency } of packages.filter(
            (directory) => basename(directory.folder) !== GSPOT_FOLDER,
        ))
            await validateCopiedLinks(roots, join(roots.revision, folder, dependency), cancelSignal);
    } finally {
        installed.close();
    }
}
