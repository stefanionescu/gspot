import pLimit from 'p-limit';
import { createHash } from 'node:crypto';
import type { Root } from '#cli/types/platform.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { isValePackageFile } from '#cli/repository/kind.ts';
import { statSync, constants, readFileSync } from 'node:fs';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import type { Directory } from '#cli/types/repository/revisions.ts';
import { MODE_BITS, PRIVATE_DIRECTORY } from '#cli/config/platform.ts';
import type { OwnershipEntry } from '#cli/types/lifecycle/lifecycle.ts';
import { sep, join, posix, dirname, basename, relative, isAbsolute } from 'node:path';
import { LOCKS, COPY_CONCURRENCY, VALE_CONFIGURATION } from '#cli/config/repository/revisions.ts';
import { cp, stat, chmod, lstat, mkdir, readdir, symlink, readlink, realpath } from 'node:fs/promises';

const MANIFESTS = new Set(['package.json', 'pyproject.toml', 'Package.swift', ...LOCKS]);
// Refuses a copied link that leaves the snapshot.
async function assertInternalLink(root: string, path: string): Promise<void> {
    let resolved: string;
    try {
        resolved = await realpath(path);
    } catch (error) {
        throw new GspotError('selection', [
            `Installed dependency link ${relative(root, path)} cannot be resolved: ${(error as Error).message}. Repair the dependency installation before checking this revision.`,
        ]);
    }
    const target = relative(root, resolved);
    const isExternal = isAbsolute(target) || target === '..' || target.startsWith(`..${sep}`);
    if (isExternal)
        throw new GspotError('selection', [
            'Installed dependencies contain an external link. Prepare isolated dependencies for the selected revision.',
        ]);
}

async function validateCopiedLinks(root: string, directory: string, cancelSignal?: AbortSignal): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        cancelSignal?.throwIfAborted();
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await validateCopiedLinks(root, path, cancelSignal);
        else if (entry.isSymbolicLink()) await assertInternalLink(root, path);
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

// Copies one log-owned package file the snapshot lacks, after checking it still matches its record.
function copyVerifiedPackage(installed: Root, destination: Root, entry: OwnershipEntry): void {
    if (entry.installed === undefined || destination.read(entry.path) !== undefined) return;
    const content = installed.read(entry.path);
    if (
        content === undefined ||
        createHash('sha256').update(content.bytes).digest('hex') !== entry.installed.hash ||
        content.mode !== entry.installed.mode
    )
        throw new GspotError('selection', [
            `Installed Vale package ${entry.path} is missing or edited. Repair it before checking this revision.`,
        ]);
    destination.write(entry.path, content, undefined);
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
function assertManifestsUnchanged(root: string, installed: Root, selected: Root, inputs: string[]): void {
    const changed = inputs.some(
        (path) =>
            statSync(join(root, path), { throwIfNoEntry: false }) === undefined ||
            !readFileSync(installed.source(path)).equals(readFileSync(selected.source(path))),
    );
    if (changed)
        throw new GspotError('selection', [
            'Installed dependencies do not match the revision manifests and locks. Prepare this revision in a separate worktree and run gspot install.',
        ]);
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
    if (statSync(target, { throwIfNoEntry: false }) !== undefined)
        throw new GspotError('selection', [
            'Installed dependencies are tracked in the selected revision. Untrack them before checking the index.',
        ]);
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

// Copies one package folder into the snapshot.
async function copyDirectory(
    root: string,
    revisionRoot: string,
    { folder, dependency }: Directory,
    cancelSignal?: AbortSignal,
): Promise<void> {
    const pending =
        basename(folder) === '.gspot' ? (readOwnership(join(root, dirname(folder))).installations ?? []) : [];
    assertDependencyReady(revisionRoot, folder, pending);
    await copyTree(join(root, folder, dependency), join(revisionRoot, folder, dependency), cancelSignal);
}

/**
 * Copy verified log-owned Vale packages matching the selected kit.
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
            const packages = readOwnership(join(root, folder)).files.filter((entry) => isValePackageFile(entry.path));
            if (packages.length === 0) continue;
            assertSameValeConfiguration(installed, destination);
            for (const entry of packages) copyVerifiedPackage(installed, destination, entry);
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
 * @param paths the snapshot's files, among them the project manifests that own dependencies
 * @param cancelSignal cancellation for the copy
 */
export async function copyDependencies(
    root: string,
    revisionRoot: string,
    paths: string[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const installed = openRoot(root, 'native');
    const selected = openRoot(revisionRoot, 'native');
    try {
        const inputs = paths.filter((path) => MANIFESTS.has(basename(path)));
        const projects = inputs.filter((path) => ['package.json', 'pyproject.toml'].includes(basename(path)));
        const directories = dependencyDirectories(installed, projects);
        if (directories.length === 0) return;
        assertManifestsUnchanged(root, installed, selected, inputs);
        const packages = directories.filter((directory) => directory.dependency === 'node_modules');
        for (const directory of packages) await copyDirectory(root, revisionRoot, directory, cancelSignal);
        // The snapshot root is compared in its resolved spelling, which a Windows temp path shortens.
        const resolvedRoot = await realpath(revisionRoot);
        for (const { folder, dependency } of packages)
            await validateCopiedLinks(resolvedRoot, join(resolvedRoot, folder, dependency), cancelSignal);
    } finally {
        installed.close();
        selected.close();
    }
}
