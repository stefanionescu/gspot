import { resolve } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import type { Files } from '#cli/types/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';

function assertValeMatches(installed: Files, destination: Files, config: string): void {
    const onDisk = installed.read(config);
    const selected = destination.read(config);
    if (onDisk === undefined || selected === undefined || !onDisk.bytes.equals(selected.bytes))
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
Copies the installed Vale packages when the copy keeps the Vale configuration they came from.

@param repositoryRoot the repository with the installed packages.
@param copyRoot where to copy the packages.
@param paths the files of the copy.
*/
export function copyValePackages(repositoryRoot: string, copyRoot: string, paths: string[]): void {
    const configurations = paths.filter(
        (path) => path === GSPOT_PATHS.valeConfigFile || path.endsWith(`/${GSPOT_PATHS.valeConfigFile}`),
    );
    using installed = openFiles(repositoryRoot);
    using destination = openFiles(resolve(copyRoot));
    const packages = listStyleFiles(installed, GSPOT_PATHS.valePackages);
    if (packages.length === 0) return;
    for (const config of configurations) assertValeMatches(installed, destination, config);
    for (const path of packages) copyValePackageFile(installed, destination, path);
}
