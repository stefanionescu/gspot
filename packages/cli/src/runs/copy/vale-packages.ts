import { resolve } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import type { Files } from '#cli/types/system/files.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { VALE_PACKAGES_PATH, VALE_TOOL_FILE_PATH } from '#cli/config/gspot-paths.ts';

// Refuses a copy whose Vale configuration differs from the one the installed packages came from.
function assertValeMatches(installed: Files, destination: Files, config: string): void {
    const current = installed.read(config);
    const selected = destination.read(config);
    if (current === undefined || selected === undefined || !current.bytes.equals(selected.bytes))
        throw new GspotError(
            'copy',
            'The installed Vale packages do not match the Vale settings of this revision. Check this commit in its own clone after running gspot apply and gspot install there.',
        );
}

function copyValePackageFile(installed: Files, destination: Files, path: string): void {
    if (destination.read(path) !== undefined) return;
    const content = installed.read(path);
    if (content === undefined)
        throw new GspotError('copy', `Installed Vale package file ${path} disappeared. Run gspot apply.`);
    destination.write(path, content, undefined);
}

/**
 * List every file under the styles folder: the Vale packages and the gspot style.
 *
 * @param files the source root of the styles folder.
 * @param folder the styles path to walk.
 * @returns the files, relative to the root.
 */
function listStyleFiles(files: Files, folder: string): string[] {
    const found: string[] = [];
    walkFiles(files, folder, (path) => {
        if (files.readStats(path)?.isDirectory() === true) return true;
        found.push(path);
        return false;
    });
    return found;
}

/**
 * Copies the installed Vale packages when the copy keeps the Vale configuration they came from.
 *
 * @param repositoryRoot the repository with the installed packages.
 * @param copyRoot where to copy the packages.
 * @param paths the files of the copy.
 */
export function copyValePackages(repositoryRoot: string, copyRoot: string, paths: string[]): void {
    const configurations = paths.filter(
        (path) => path === VALE_TOOL_FILE_PATH || path.endsWith(`/${VALE_TOOL_FILE_PATH}`),
    );
    using installed = openFiles(repositoryRoot);
    using destination = openFiles(resolve(copyRoot));
    const packages = listStyleFiles(installed, VALE_PACKAGES_PATH);
    if (packages.length === 0) return;
    for (const config of configurations) assertValeMatches(installed, destination, config);
    for (const path of packages) copyValePackageFile(installed, destination, path);
}
