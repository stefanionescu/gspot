import { cp } from 'node:fs/promises';
import { GspotError } from '#cli/platform/public.ts';
import { runGit } from '#cli/platform/git/public.ts';
import { isInside } from '#cli/platform/contracts.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { openRoot } from '#cli/platform/root/public.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { MODE_BITS } from '#cli/config/platform/modes.ts';
import { lockfileEntry } from '#cli/parsers/contracts.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { isValePackageFile } from '#cli/repository/public.ts';
import { nativeSegments } from '#cli/platform/root/contracts.ts';
import { getOwnership } from '#cli/lifecycle/ownership/public.ts';
import { listStyleFiles } from '#cli/lifecycle/install/contracts.ts';
import { DOT_GSPOT, VALE_CONFIG } from '#cli/config/platform/locations.ts';
import { join, posix, dirname, resolve, basename, relative } from 'node:path';
import { CLONE_OPTIONS, PACKAGE_MANIFESTS } from '#cli/config/execution/copy.ts';

import type {
    TreeCopy,
    ScratchCopy,
    WorktreeCopy,
    DependencyCopy,
    DependencyFolder,
} from '#cli/types/execution/copy.ts';
import {
    statSync,
    chmodSync,
    constants,
    lstatSync,
    mkdirSync,
    unlinkSync,
    symlinkSync,
    copyFileSync,
    realpathSync,
} from 'node:fs';

// Native copying collects links without a second filesystem walk, then repairs only those links.
async function copyTree(
    context: WorktreeCopy,
    source: string,
    target: string,
    operation: DependencyCopy['operation'],
): Promise<void> {
    if (operation === 'link') {
        symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
        return;
    }
    context.copies.set(source, target);
    await cp(source, target, {
        ...CLONE_OPTIONS,
        mode: constants.COPYFILE_FICLONE,
        filter: (path, destination) => {
            context.cancelSignal?.throwIfAborted();
            if (lstatSync(path).isSymbolicLink()) {
                const original = realpathSync(path);
                if (isInside(relative(original, context.root)))
                    throw new GspotError('selection', [
                        `Installed dependency link ${relative(context.scratch, destination)} leaves the repository. Prepare isolated dependencies for this revision.`,
                    ]);
                context.links.push({ source: original, target: destination });
            }
            return true;
        },
    });
    chmodSync(target, statSync(source).mode & MODE_BITS);
}

// Where a path inside a copied tree lives in the scratch copy, or undefined when no copy holds it.
function relocated(copies: Map<string, string>, source: string): string | undefined {
    for (const [original, copied] of [...copies].toSorted(([left], [right]) => right.length - left.length)) {
        const local = relative(original, source);
        if (isInside(local)) return join(copied, local);
    }
    return undefined;
}

// Every dependency link uses the same containment and private-clone policy.
async function repairLink(context: WorktreeCopy, { source, target }: TreeCopy): Promise<void> {
    const copied = relocated(context.copies, source);
    unlinkSync(target);
    const directory = statSync(source).isDirectory();
    if (copied !== undefined) {
        if (statSync(copied, { throwIfNoEntry: false }) !== undefined)
            symlinkSync(relative(dirname(target), copied), target, directory ? 'dir' : 'file');
        return;
    }
    if (directory) await copyTree(context, source, target, 'clone');
    else copyFileSync(source, target, constants.COPYFILE_FICLONE);
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

// Copies one package file the copy lacks through the same confined native writer.
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

/**
 * Clone installed dependency trees and repair contained links in the scratch copy.
 * @param input the owned scratch copy and selected dependency operations
 * @returns completion after every dependency and link has settled
 */
/**
 * Clone installed dependency trees and repair contained links in the scratch copy.
 * @param input the owned scratch copy and selected dependency operations
 * @returns completion after every dependency and link has settled
 */
export async function copyDependencies(input: ScratchCopy): Promise<void> {
    const root = realpathSync(input.root);
    const context: WorktreeCopy = {
        root,
        scratch: input.target,
        copies: new Map([[root, input.target]]),
        links: [],
        cancelSignal: input.cancelSignal,
    };
    for (const dependency of input.dependencies) {
        input.cancelSignal?.throwIfAborted();
        const source = realpathSync(join(root, dependency.path));
        const target = join(input.target, ...nativeSegments(dependency.path));
        mkdirSync(dirname(target), { recursive: true });
        await copyTree(context, source, target, dependency.operation);
    }
    // Parent targets are cloned before links into them, including trees found by another link.
    while (context.links.length > 0) {
        context.links = context.links.toSorted((left, right) => left.source.length - right.source.length);
        const link = context.links.shift();
        if (link !== undefined) await repairLink(context, link);
        input.cancelSignal?.throwIfAborted();
    }
}

/**
 * Copy the installed Vale packages into a copy whose Vale configuration matches the one they were installed for.
 * @param root the repository root
 * @param checkout the copy directory the packages are copied into
 * @param paths the copy's files, among them the Vale configurations that name packages
 */
export function copyValePackages(root: string, checkout: string, paths: string[]): void {
    const configurations = paths.filter((path) => path === VALE_CONFIG || path.endsWith(`/${VALE_CONFIG}`));
    for (const config of configurations) {
        const folder = config.slice(0, -VALE_CONFIG.length);
        using installed = openRoot(join(root, folder));
        using destination = openRoot(resolve(checkout, folder), 'native');
        const packages = listStyleFiles(installed).filter((path) => isValePackageFile(path));
        if (packages.length === 0) continue;
        assertValeMatches(installed, destination);
        for (const path of packages) copyPackageFile(installed, destination, path);
    }
}

/**
 * Select installed packages after checking the copied project inputs.
 * @param root the repository root
 * @param checkout the private copy
 * @param entries Git entries with each project's manifests
 * @param cancelSignal cancellation for the copy
 * @returns guarded dependency operations
 */
export async function revisionDependencies(
    root: string,
    checkout: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<DependencyCopy[]> {
    using installed = openRoot(root, 'native');
    const inputs = entries.filter((entry) => {
        const name = basename(entry.path);
        const lockfile = lockfileEntry(name);
        return (
            PACKAGE_MANIFESTS.includes(name) ||
            name === 'Package.swift' ||
            (lockfile !== undefined && 'snapshot' in lockfile)
        );
    });
    const projects = inputs.map((entry) => entry.path).filter((path) => PACKAGE_MANIFESTS.includes(basename(path)));
    const directories = getDependencies(installed, projects);
    if (directories.length === 0) return [];
    await assertManifestsUnchanged(root, installed, inputs, cancelSignal);
    return directories
        .filter((directory) => directory.dependency === 'node_modules')
        .map(({ folder, dependency }) => {
            const isToolProject = basename(folder) === DOT_GSPOT;
            assertDependencyReady(
                checkout,
                folder,
                isToolProject ? (getOwnership(join(root, dirname(folder))).installing ?? []) : [],
            );
            const path = posix.join(folder, dependency);
            if (lstatSync(join(checkout, path), { throwIfNoEntry: false }) !== undefined)
                throw new GspotError('selection', [
                    'Installed dependencies are tracked in the selected revision. Untrack them before checking again.',
                ]);
            return { path, operation: isToolProject ? 'link' : 'clone' };
        });
}
