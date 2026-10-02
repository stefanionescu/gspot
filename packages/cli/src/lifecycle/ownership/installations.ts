// A private tool installation as one unit: written beside its folder, swapped in by a rename, and recorded by kind
// instead of file by file. A crash between the renames leaves the previous folder where recovery finds it.
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { EXECUTABLE_FILE } from '#cli/config/platform/platform.ts';
import { INSTALLATION_DIRECTORIES } from '#cli/config/lifecycle/ownership.ts';
import type { InstalledOutput, InstallationKind } from '#cli/types/tools/tools.ts';

// The folder an installation is staged in before the swap, and the one the previous installation waits in.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Installing a tree and recovering an interrupted install name the side folders of a kind the same way.
function sideFolders(kind: InstallationKind): { folder: string; staging: string; previous: string } {
    const folder = INSTALLATION_DIRECTORIES[kind];
    return { folder, staging: `${folder}.next`, previous: `${folder}.previous` };
}

// Marks or clears an installation in progress, which tool inspection reports as pending.
function setInProgress(log: Log, kind: InstallationKind, isInProgress: boolean): void {
    const others = (log.state.installations ?? []).filter((entry) => entry !== kind);
    const installations = isInProgress ? [...others, kind] : others;
    if (installations.length === 0) delete log.state.installations;
    else log.state.installations = installations;
    log.save();
}

// Records whether gspot owns the finished folder of a kind.
function setInstalled(log: Log, kind: InstallationKind, isInstalled: boolean): void {
    const others = (log.state.installs ?? []).filter((entry) => entry !== kind);
    const installs = isInstalled ? [...others, kind].toSorted((left, right) => left.localeCompare(right)) : others;
    if (installs.length === 0) delete log.state.installs;
    else log.state.installs = installs;
    log.save();
}

/**
 * Settles installations a crash interrupted: the previous folder returns when the new one never arrived, and the
 * side folders go. The installation stays marked in progress until the next install finishes.
 * @param log the open log
 */
export function recoverInstallations(log: Log): void {
    for (const kind of log.state.installations ?? []) {
        const { folder, staging, previous } = sideFolders(kind);
        if (log.files.stat(folder) === undefined && log.files.stat(previous) !== undefined)
            log.files.rename(previous, folder);
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
    if (state.installs?.includes(kind) !== true && files.list(folder).length > 0)
        throw new Error(`Preserved unowned ${folder}. Move it aside before installing.`);
    setInProgress(log, kind, true);
    files.removeTree(staging);
    files.mkdir(staging, EXECUTABLE_FILE);
    // A link is written after the file it names, which the write checks is there.
    const ordered = outputs.toSorted(
        (left, right) => Number(left.file.isLink === true) - Number(right.file.isLink === true),
    );
    for (const { path, file } of ordered) files.write(`${staging}${path.slice(folder.length)}`, file, undefined);
    files.removeTree(previous);
    if (files.stat(folder) !== undefined) files.rename(folder, previous);
    files.rename(staging, folder);
    files.removeTree(previous);
    setInstalled(log, kind, true);
    setInProgress(log, kind, false);
}

/**
 * Deletes an installation gspot made, and its record.
 * @param log the open log
 * @param kind the installation
 */
export function deleteInstallation(log: Log, kind: InstallationKind): void {
    if (log.state.installs?.includes(kind) !== true) return;
    log.files.removeTree(INSTALLATION_DIRECTORIES[kind]);
    setInstalled(log, kind, false);
}
