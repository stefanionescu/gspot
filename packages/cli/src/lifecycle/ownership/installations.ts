// A tool-project installation as one unit: written beside its folder, swapped in by a rename, and recorded by kind
// instead of file by file. A crash between the renames leaves the previous folder where recovery finds it.
import { toPosix } from '#cli/platform/paths.ts';
import { sourcePath } from '#cli/platform/root/reads.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import { join, posix, basename, relative } from 'node:path';
import type { InstalledFile } from '#cli/types/tools/install.ts';
import { assertMutationTarget } from '#cli/platform/root/rules.ts';
import type { InstallationKind } from '#cli/types/configurations.ts';
import { MODE_BITS, EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import type { Log, InstallationFolders } from '#cli/types/lifecycle/ownership.ts';

import {
    NODE_MODULES_DIRECTORY,
    INSTALLATION_DIRECTORIES,
    PYTHON_ENVIRONMENT_DIRECTORY,
} from '#cli/config/platform/locations.ts';
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
function installedFile(directory: string, realPath: string, outputPath: string, source: string): FileCopy {
    if (realPath === outputPath) {
        const entry = join(directory, realPath);
        const link = linkTarget(entry);
        if (link !== undefined)
            return { bytes: Buffer.from(link), mode: lstatSync(entry).mode & MODE_BITS, isLink: true };
    }
    const descriptor = openSync(source, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
        const stat = fstatSync(descriptor);
        if (!stat.isFile()) throw new Error(`Unsupported installed entry: ${realPath}`);
        return { bytes: readFileSync(descriptor), mode: stat.mode & MODE_BITS };
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
 * @param outputs every file of the installation, at its path under the installation folder
 */
export function installTree(log: Log, kind: InstallationKind, outputs: InstalledFile[]): void {
    const { files, state } = log;
    const { folder, staging, previous } = sideFolders(kind);
    // An install still in progress made the folder: a crash after its swap and before its record leaves it there.
    const isOwned = state.installed?.includes(kind) === true || state.installing?.includes(kind) === true;
    if (!isOwned && files.list(folder).length > 0)
        throw new Error(`${folder} exists and gspot did not create it. Move it aside, then run gspot install.`);
    setKind(log, 'installing', kind, true);
    files.removeTree(staging);
    files.mkdir(staging, EXECUTABLE_FILE);
    // A link is written after the file it names, which the write checks is there.
    const ordered = outputs.toSorted(
        (left, right) => Number(left.file.isLink === true) - Number(right.file.isLink === true),
    );
    for (const { path, file } of ordered) files.write(`${staging}${path.slice(folder.length)}`, file, undefined);
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
    log.files.removeTree(INSTALLATION_DIRECTORIES[kind]);
    setKind(log, 'installed', kind, false);
}

/**
 * Reads a complete isolated installation before the owner swaps it in. A link cycle or a link that leaves it is refused.
 * @param directory the isolated installation
 * @param kind whether the installation is the npm project or the Python environment
 * @returns every file, at its destination under .gspot/node_modules or .gspot/.venv
 */
export function readInstalledTree(directory: string, kind: InstallationKind): InstalledFile[] {
    const destination = kind === 'npm' ? NODE_MODULES_DIRECTORY : PYTHON_ENVIRONMENT_DIRECTORY;
    const outputs: InstalledFile[] = [];
    const entry = lstatSync(directory, { throwIfNoEntry: false });
    if (entry?.isSymbolicLink() === true) throw new Error(`Unsafe lifecycle destination: ${basename(directory)}`);
    if (entry?.isDirectory() !== true) throw new Error(`Installed output is not a directory: ${directory}`);
    const root = realpathSync(directory);
    const cacheDirectory = kind === 'python' ? '__pycache__' : undefined;
    const collect = (prefix: string | undefined, output: string, ancestors: string[]): void => {
        const canonical = join(root, prefix ?? '');
        if (ancestors.includes(canonical)) throw new Error(`Installed directory link forms a cycle: ${output}`);
        for (const name of readdirSync(canonical).toSorted((left, right) => left.localeCompare(right))) {
            const realPath = posix.join(prefix ?? '', name);
            const outputPath = posix.join(output, name);
            const path = `${destination}/${outputPath}`;
            assertMutationTarget(path);
            const source = sourcePath(root, realPath);
            if (lstatSync(source).isDirectory()) {
                if (name === cacheDirectory) continue;
                collect(toPosix(relative(root, source)), outputPath, [...ancestors, canonical]);
            } else outputs.push({ path, file: installedFile(directory, realPath, outputPath, source) });
        }
    };
    collect(undefined, '', []);
    return outputs;
}
