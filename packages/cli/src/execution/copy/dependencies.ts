// Attach the original tool installation to a read-only revision copy.
import { runGit } from '#cli/platform/git.ts';
import { listStyleFiles } from '#cli/tools/vale.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { Root } from '#cli/types/platform/root.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import { isValePackageFile } from '#cli/repository/kind.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { getOwnership } from '#cli/lifecycle/ownership/log.ts';
import { PRIVATE_DIRECTORY } from '#cli/config/platform/modes.ts';
import { PROJECT_MANIFESTS } from '#cli/config/execution/copy.ts';
import { join, posix, dirname, resolve, basename } from 'node:path';
import { DOT_GSPOT, VALE_CONFIG } from '#cli/config/platform/locations.ts';
import type { DependencyCopy, DependencyFolder } from '#cli/types/execution/copy.ts';
import { statSync, chmodSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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
function assertValeMatches(installed: Root, destination: string): void {
    const current = installed.read(VALE_CONFIG);
    const path = join(destination, VALE_CONFIG);
    const selected = lstatSync(path, { throwIfNoEntry: false });
    if (selected !== undefined && (!selected.isFile() || selected.nlink !== 1))
        throw new Error(`Lifecycle destination is not a private regular file: ${VALE_CONFIG}`);
    if (current === undefined || selected === undefined || !current.bytes.equals(readFileSync(path)))
        throw new GspotError('selection', [
            'Installed Vale packages do not match the revision configuration. Prepare this revision separately and run gspot apply.',
        ]);
}

// Copies one package file the copy lacks.
function copyPackageFile(installed: Root, destination: string, path: string): void {
    const target = join(destination, path);
    for (let directory = dirname(target); directory !== destination; directory = dirname(directory)) {
        const parent = lstatSync(directory, { throwIfNoEntry: false });
        if (parent?.isDirectory() === false) throw new Error(`Unsafe lifecycle parent: ${path}`);
    }
    const selected = lstatSync(target, { throwIfNoEntry: false });
    if (selected !== undefined) {
        if (!selected.isFile() || selected.nlink !== 1)
            throw new Error(`Lifecycle destination is not a private regular file: ${path}`);
        return;
    }
    const content = installed.read(path);
    if (content === undefined)
        throw new GspotError('selection', [`Installed Vale package file ${path} disappeared. Run gspot apply.`]);
    mkdirSync(dirname(target), { recursive: true, mode: PRIVATE_DIRECTORY });
    writeFileSync(target, content.bytes, { flag: 'wx', mode: content.mode });
    chmodSync(target, content.mode);
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
        const destination = resolve(checkout, folder);
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
            PROJECT_MANIFESTS.includes(name) ||
            name === 'Package.swift' ||
            (lockfile !== undefined && 'snapshot' in lockfile)
        );
    });
    const projects = inputs.map((entry) => entry.path).filter((path) => PROJECT_MANIFESTS.includes(basename(path)));
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
