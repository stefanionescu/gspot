// Attach the original tool installation to a read-only revision copy.
import { memo } from '#cli/platform/memo.ts';
import { runGit } from '#cli/platform/git.ts';
import { statSync, lstatSync } from 'node:fs';
import { listStyleFiles } from '#cli/tools/vale.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { isInScope } from '#cli/repository/selectors.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import { isValePackageFile } from '#cli/repository/kind.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { packageWorkspaces } from '#cli/repository/scopes.ts';
import { getOwnership } from '#cli/lifecycle/ownership/log.ts';
import { PACKAGE_MANIFESTS } from '#cli/config/execution/copy.ts';
import { join, posix, dirname, resolve, basename } from 'node:path';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { DOT_GSPOT, VALE_CONFIG } from '#cli/config/platform/locations.ts';
import { readPackageManifest } from '#cli/repository/package-manifests.ts';
import type { DependencyCopy, DependencyFolder } from '#cli/types/execution/copy.ts';

const WORKSPACE_SOURCE_MEMO = { create: () => new Map<string, string[]>() };

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

/**
 * Select declared workspace sources from this run's repository inventory.
 * @param root the source root
 * @param scope the owning project
 * @param files the source inventory
 * @param reads the metadata cache
 * @returns workspace dependency paths
 */
export function workspaceSourceFiles(root: string, scope: string, files: TrackedFile[], reads: ReadCache): string[] {
    const cache = memo(reads, WORKSPACE_SOURCE_MEMO);
    const project = files
        .filter(
            (file) =>
                basename(file.path) === 'package.json' &&
                isInScope(scope, file.path === 'package.json' ? '' : posix.dirname(file.path)),
        )
        .toSorted((left, right) => right.path.length - left.path.length)[0];
    if (project === undefined) return [];
    const key = JSON.stringify([root, project.path]);
    const held = cache.get(key);
    if (held !== undefined) return held;
    const projectFolder = project.path === 'package.json' ? '' : posix.dirname(project.path);
    const packages = packageWorkspaces(root).map((path) => ({
        path,
        manifest: readPackageManifest(root, posix.join(path, 'package.json')),
    }));
    const pending = [projectFolder];
    const visited = new Set<string>();
    for (const folder of pending) {
        if (visited.has(folder)) continue;
        visited.add(folder);
        const manifest = readPackageManifest(root, posix.join(folder, 'package.json'));
        if (manifest === undefined)
            throw new Error(`Workspace manifest is missing: ${posix.join(folder, 'package.json')}`);
        const names = Object.keys({
            ...manifest.dependencies,
            ...manifest.devDependencies,
            ...manifest.peerDependencies,
            ...manifest.optionalDependencies,
        });
        pending.push(
            ...packages
                .filter((entry) => entry.manifest?.name !== undefined && names.includes(entry.manifest.name))
                .map((entry) => entry.path),
        );
    }
    visited.delete(projectFolder);
    const ordered = packages.toSorted((left, right) => right.path.length - left.path.length);
    const selected = files
        .filter((file) => {
            const owner = ordered.find((entry) => isInScope(file.path, entry.path));
            return owner !== undefined && visited.has(owner.path);
        })
        .map((file) => file.path);
    cache.set(key, selected);
    return selected;
}
