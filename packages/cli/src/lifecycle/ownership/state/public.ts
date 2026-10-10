// A tool-project installation as one unit: written beside its folder, swapped in by a rename, and recorded by kind
// instead of file by file. A crash between the renames leaves the previous folder where recovery finds it.
import { toPosix } from '#cli/platform/contracts.ts';
import { sourcePath } from '#cli/platform/root/reads.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import { join, posix, basename, relative } from 'node:path';
import type { InstalledFile } from '#cli/types/tools/install.ts';
import type { InstallationKind } from '#cli/types/configurations.ts';
import { assertMutationTarget } from '#cli/platform/root/contracts.ts';
import { INSTALLATION_DIRECTORIES } from '#cli/config/platform/locations.ts';
import type { Log, InstallationFolders } from '#cli/types/lifecycle/ownership.ts';
import { MODE_BITS, READ_ONLY_FILE, EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';

import {
    openSync,
    closeSync,
    constants,
    fstatSync,
    lstatSync,
    readdirSync,
    readFileSync,
    readlinkSync,
    realpathSync,
} from 'node:fs';

// The folder an installation is staged in before the swap, and the one the previous installation waits in.

function sideFolders(kind: InstallationKind): InstallationFolders {
    const folder = INSTALLATION_DIRECTORIES[kind];
    return { folder, staging: `${folder}.next`, previous: `${folder}.previous` };
}

// Marks or clears an installation in progress, which tool inspection reports as pending.
function setKind(log: Log, field: 'installing' | 'installed', kind: InstallationKind, isPresent: boolean): void {
    const others = (log.state[field] ?? []).filter((entry) => entry !== kind);
    const kinds = isPresent ? [...others, kind].toSorted((left, right) => left.localeCompare(right)) : others;
    log.state[field] = kinds.length === 0 ? undefined : kinds;
    log.save();
}

// Read a link's target without a separate filesystem check.
function linkTarget(entry: string): string | undefined {
    try {
        return readlinkSync(entry);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EINVAL') return undefined;
        throw error;
    }
}

// Preserve file links at their original location and copy their bytes inside a directory alias.
function installedFile(
    directory: string,
    realPath: string,
    filePath: string,
    source: string,
    kind: InstallationKind,
): FileCopy {
    if (realPath === filePath) {
        const entry = join(directory, realPath);
        const link = linkTarget(entry);
        if (link !== undefined)
            return { bytes: Buffer.from(link), mode: lstatSync(entry).mode & MODE_BITS, isLink: true };
    }
    const descriptor = openSync(source, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
        const stat = fstatSync(descriptor);
        if (kind === 'vale' && (!stat.isFile() || stat.nlink !== 1))
            throw new Error(
                `Lifecycle destination is not a private regular file: ${INSTALLATION_DIRECTORIES[kind]}/${filePath}`,
            );
        if (!stat.isFile()) throw new Error(`Unsupported installed entry: ${realPath}`);
        return { bytes: readFileSync(descriptor), mode: kind === 'vale' ? READ_ONLY_FILE : stat.mode & MODE_BITS };
    } finally {
        closeSync(descriptor);
    }
}

/**
 * Settles installations a crash interrupted: the previous folder returns when the new one never arrived, and the
 * side folders go. The installation stays marked in progress until the next install finishes.
 * @param log the open log
 */
export function recoverInstallations(log: Log): void {
    for (const kind of log.state.installing ?? []) {
        const { folder, staging, previous } = sideFolders(kind);
        if (log.files.stat(folder) === undefined && log.files.stat(previous) !== undefined)
            log.files.renameDirectory(previous, folder);
        log.files.removeTree(previous);
        log.files.removeTree(staging);
    }
}

/**
 * Writes a finished installation beside its folder and swaps it in. A folder gspot did not install is refused.
 * @param log the open log
 * @param kind the installation
 * @param entries every file of the installation, at its path under the installation folder
 */
export async function installTree(log: Log, kind: InstallationKind, entries: InstalledFile[]): Promise<void> {
    const { files, state } = log;
    const { folder, staging, previous } = sideFolders(kind);
    // An install still in progress made the folder: a crash after its swap and before its record leaves it there.
    const isOwned = state.installed?.includes(kind) === true || state.installing?.includes(kind) === true;
    if (!isOwned && files.list(folder).length > 0)
        throw new Error(`${folder} exists and gspot did not create it. Move it aside, then run gspot install.`);
    setKind(log, 'installing', kind, true);
    files.removeTree(staging);
    files.mkdir(staging, EXECUTABLE_FILE);
    await files.writeAll(
        entries
            .filter(({ file }) => file.isLink !== true)
            .map(({ path, file }) => ({
                path: `${staging}${path.slice(folder.length)}`,
                value: { bytes: file.bytes, mode: file.mode },
            })),
    );
    // A link is written after every regular file is flushed and committed.
    for (const { path, file } of entries.filter((entry) => entry.file.isLink === true))
        files.write(`${staging}${path.slice(folder.length)}`, file, undefined);
    files.removeTree(previous);
    if (files.stat(folder) !== undefined) files.renameDirectory(folder, previous);
    files.renameDirectory(staging, folder);
    files.removeTree(previous);
    setKind(log, 'installed', kind, true);
    setKind(log, 'installing', kind, false);
}

/**
 * Deletes an installation gspot made, and its record.
 * @param log the open log
 * @param kind the installation
 */
export function deleteInstallation(log: Log, kind: InstallationKind): void {
    if (log.state.installed?.includes(kind) !== true) return;
    if (kind === 'vale' && log.files.stat(INSTALLATION_DIRECTORIES[kind]) !== undefined)
        readInstalledTree(log.files.realPath(INSTALLATION_DIRECTORIES[kind]), kind);
    log.files.removeTree(INSTALLATION_DIRECTORIES[kind]);
    setKind(log, 'installed', kind, false);
}

/**
 * Reads a complete isolated installation before the owner swaps it in. A link cycle or a link that leaves it is refused.
 * @param directory the isolated installation
 * @param kind the logged installation kind
 * @returns every file, at its declared installation destination
 */
export function readInstalledTree(directory: string, kind: InstallationKind): InstalledFile[] {
    const destination = INSTALLATION_DIRECTORIES[kind];
    const entries: InstalledFile[] = [];
    const entry = lstatSync(directory, { throwIfNoEntry: false });
    if (entry?.isSymbolicLink() === true) throw new Error(`Unsafe lifecycle destination: ${basename(directory)}`);
    if (entry?.isDirectory() !== true) throw new Error(`Installed folder is not a directory: ${directory}`);
    const root = realpathSync(directory);
    const cacheDirectory = kind === 'python' ? '__pycache__' : undefined;
    const collect = (prefix: string, target: string, ancestors: string[]): void => {
        const canonical = join(root, prefix);
        if (ancestors.includes(canonical)) throw new Error(`Installed directory link forms a cycle: ${target}`);
        const names = readdirSync(canonical).filter(
            (name) => name !== cacheDirectory || !lstatSync(sourcePath(root, posix.join(prefix, name))).isDirectory(),
        );
        for (const name of names.toSorted((left, right) => left.localeCompare(right))) {
            const realPath = posix.join(prefix, name);
            const filePath = posix.join(target, name);
            const path = `${destination}/${filePath}`;
            assertMutationTarget(path);
            if (kind === 'vale' && lstatSync(join(root, realPath)).isSymbolicLink())
                throw new Error(`Unsafe lifecycle destination: ${path}`);
            const source = sourcePath(root, realPath);
            if (lstatSync(source).isDirectory()) {
                collect(toPosix(relative(root, source)), filePath, [...ancestors, canonical]);
            } else entries.push({ path, file: installedFile(directory, realPath, filePath, source, kind) });
        }
    };
    collect('', '', []);
    return entries;
}
