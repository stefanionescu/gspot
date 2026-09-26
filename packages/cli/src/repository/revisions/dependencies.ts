import pLimit from 'p-limit';
import { createHash } from 'node:crypto';
import type { ConfinedRoot } from '#cli/types/platform.ts';
import { constants, readFileSync, statSync } from 'node:fs';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { SelectionError } from '#cli/configurations/select.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { OwnershipEntry } from '#cli/types/lifecycle/lifecycle.ts';
import { MODE_BITS, PRIVATE_DIRECTORY } from '#cli/constants/platform.ts';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import { chmod, cp, mkdir, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
import { pythonLauncher, relocateLaunchers } from '#cli/repository/revisions/python-launchers.ts';
import { COPY_CONCURRENCY, LOCKS, VALE_CONFIGURATION } from '#cli/constants/repository/revisions.ts';
import type { Directory, PythonLauncher, RelocationContext } from '#cli/types/repository/revisions.ts';
import { pathRelocator, relocateSitePackages } from '#cli/repository/revisions/python-site-packages.ts';

const MANIFESTS = new Set(['package.json', 'pyproject.toml', 'Package.swift', ...LOCKS]);
// Refuses a copied link that leaves the snapshot, unless it is an interpreter link the environment declared.
async function assertInternalLink(
    root: string,
    path: string,
    interpreterLinks: ReadonlyMap<string, ReadonlySet<string>>,
): Promise<void> {
    let resolved: string;
    try {
        resolved = await realpath(path);
    } catch (error) {
        throw new SelectionError([
            `Installed dependency link ${relative(root, path)} cannot be resolved: ${(error as Error).message}. Repair the dependency installation before checking this revision.`,
        ]);
    }
    const target = relative(root, resolved);
    const isExternal = isAbsolute(target) || target === '..' || target.startsWith(`..${sep}`);
    if (isExternal && interpreterLinks.get(path)?.has(resolved) !== true)
        throw new SelectionError([
            'Installed dependencies contain an external link. Prepare isolated dependencies for the selected revision.',
        ]);
}

async function validateCopiedLinks(
    root: string,
    directory: string,
    interpreterLinks: ReadonlyMap<string, ReadonlySet<string>>,
    cancelSignal?: AbortSignal,
): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        cancelSignal?.throwIfAborted();
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await validateCopiedLinks(root, path, interpreterLinks, cancelSignal);
        else if (entry.isSymbolicLink()) await assertInternalLink(root, path, interpreterLinks);
    }
}

function assertDependencyReady(snapshot: string, folder: string, dependency: string, pending: string[]): void {
    if (basename(folder) === '.gspot' && pending.includes(dependency === 'node_modules' ? 'npm' : 'python'))
        throw new SelectionError([
            'Tool installation is incomplete. Run gspot install before checking staged content.',
        ]);
    if (
        !LOCKS.some((lock) => statSync(join(snapshot, folder, lock), { throwIfNoEntry: false }) !== undefined) &&
        !LOCKS.some((lock) => statSync(join(snapshot, lock), { throwIfNoEntry: false }) !== undefined)
    )
        throw new SelectionError([
            'A revision dependency project has no lock to verify its installed environment. Prepare locked dependencies for this revision.',
        ]);
}

// Refuses a snapshot whose Vale configuration differs from the one the packages were installed for.
function assertSameValeConfiguration(installed: ConfinedRoot, destination: ConfinedRoot): void {
    const current = installed.read(VALE_CONFIGURATION);
    const selected = destination.read(VALE_CONFIGURATION);
    if (current === undefined || selected === undefined || !current.bytes.equals(selected.bytes))
        throw new SelectionError([
            'Installed Vale packages do not match the revision configuration. Prepare this revision separately and run gspot apply.',
        ]);
}

// Copies one journal-owned package file the snapshot lacks, after checking it still matches its record.
function copyVerifiedPackage(installed: ConfinedRoot, destination: ConfinedRoot, entry: OwnershipEntry): void {
    if (entry.installed === undefined || destination.read(entry.path) !== undefined) return;
    const content = installed.read(entry.path);
    if (
        content === undefined ||
        createHash('sha256').update(content.bytes).digest('hex') !== entry.installed.hash ||
        content.mode !== entry.installed.mode
    )
        throw new SelectionError([
            `Installed Vale package ${entry.path} is missing or edited. Repair it before checking this revision.`,
        ]);
    destination.write(entry.path, content, undefined);
}

// The dependency folders the snapshot's projects own, when the working tree has them installed.
function dependencyDirectories(installed: ConfinedRoot, projects: string[]): Directory[] {
    return projects.flatMap((path) => {
        const folder = dirname(path);
        const dependency = basename(path) === 'package.json' ? 'node_modules' : '.venv';
        return installed.stat(posix.join(folder, dependency)) === undefined ? [] : [{ folder, dependency }];
    });
}

// Refuses a snapshot whose manifests or locks differ from the working tree's, which the installation came from.
function assertManifestsUnchanged(
    root: string,
    installed: ConfinedRoot,
    selected: ConfinedRoot,
    inputs: string[],
): void {
    const changed = inputs.some(
        (path) =>
            statSync(join(root, path), { throwIfNoEntry: false }) === undefined ||
            !readFileSync(installed.source(path)).equals(readFileSync(selected.source(path))),
    );
    if (changed)
        throw new SelectionError([
            'Installed dependencies do not match the revision manifests and locks. Prepare this revision in a separate worktree and run gspot install.',
        ]);
}

// Copies one dependency tree into the snapshot with the mode of its source, draining every child before returning.
async function copyTree(source: string, target: string, cancelSignal?: AbortSignal): Promise<void> {
    if (statSync(target, { throwIfNoEntry: false }) !== undefined)
        throw new SelectionError([
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

// Copies one dependency folder and, for a virtual environment, reads the launcher facts the relocation needs.
async function copyDirectory(
    context: RelocationContext,
    { folder, dependency }: Directory,
    interpreterLinks: Map<string, ReadonlySet<string>>,
): Promise<PythonLauncher | undefined> {
    const { root, snapshot, cancelSignal } = context;
    const pending =
        basename(folder) === '.gspot' ? (readOwnership(join(root, dirname(folder))).installations ?? []) : [];
    assertDependencyReady(snapshot, folder, dependency, pending);
    const source = join(root, folder, dependency);
    await copyTree(source, join(snapshot, folder, dependency), cancelSignal);
    return dependency === '.venv' ? await pythonLauncher(context, folder, source, interpreterLinks) : undefined;
}

/**
 * Copy verified journal-owned Vale packages matching the selected configuration.
 * @param root the repository root
 * @param snapshot the snapshot directory the packages are copied into
 * @param paths the snapshot's files, among them the Vale configurations that name packages
 */
export function copyProsePackages(root: string, snapshot: string, paths: string[]): void {
    const configs = paths.filter((path) => path === VALE_CONFIGURATION || path.endsWith(`/${VALE_CONFIGURATION}`));
    for (const config of configs) {
        const folder = dirname(dirname(dirname(config)));
        const installed = openConfinedRoot(join(root, folder));
        const destination = openConfinedRoot(join(snapshot, folder));
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
 * Copy matching installed dependencies and relocate their revision-specific loader paths.
 * @param root the repository root
 * @param snapshot the snapshot directory the dependencies are copied into
 * @param paths the snapshot's files, among them the project manifests that own dependencies
 * @param cancelSignal cancellation for the copy
 */
export async function copyDependencies(
    root: string,
    snapshot: string,
    paths: string[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const installed = openConfinedRoot(root, 'native');
    const selected = openConfinedRoot(snapshot, 'native');
    try {
        const inputs = paths.filter((path) => MANIFESTS.has(basename(path)));
        const projects = inputs.filter((path) => ['package.json', 'pyproject.toml'].includes(basename(path)));
        const directories = dependencyDirectories(installed, projects);
        if (directories.length === 0) return;
        assertManifestsUnchanged(root, installed, selected, inputs);
        const context: RelocationContext = {
            root,
            snapshot,
            selected,
            ...(cancelSignal === undefined ? {} : { cancelSignal }),
        };
        const interpreterLinks = new Map<string, ReadonlySet<string>>();
        const launchers: PythonLauncher[] = [];
        for (const directory of directories) {
            const launcher = await copyDirectory(context, directory, interpreterLinks);
            if (launcher !== undefined) launchers.push(launcher);
        }
        for (const { folder, dependency } of directories)
            await validateCopiedLinks(snapshot, join(snapshot, folder, dependency), interpreterLinks, cancelSignal);
        const relocatePath = await pathRelocator(context);
        for (const launcher of launchers) await relocateLaunchers(context, launcher);
        for (const launcher of launchers) await relocateSitePackages(context, launcher, relocatePath);
    } finally {
        installed.close();
        selected.close();
    }
}
