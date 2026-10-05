// A private tool installation as one unit: written beside its folder, swapped in by a rename, and recorded by kind
// instead of file by file. A crash between the renames leaves the previous folder where recovery finds it.
import { EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import { INSTALLATION_DIRECTORIES } from '#cli/config/lifecycle/ownership.ts';
import type { Log, InstallationFolders } from '#cli/types/lifecycle/ownership.ts';
import type { InstalledOutput, InstallationKind } from '#cli/types/tools/install.ts';

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
export function installTree(log: Log, kind: InstallationKind, outputs: InstalledOutput[]): void {
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
