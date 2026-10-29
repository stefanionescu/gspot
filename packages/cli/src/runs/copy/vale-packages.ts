import { GspotError } from '#cli/system/errors.ts';
import { join, resolve, dirname } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { statSync, mkdirSync, symlinkSync } from 'node:fs';
import { INSTALLED_VALE_MESSAGE } from '#cli/config/runs/copy/vale-packages.ts';

function assertValeMatches(installed: Files, destination: Files, config: string): void {
    const onDisk = installed.read(config);
    const selected = destination.read(config);
    if (onDisk === undefined || selected === undefined || !onDisk.bytes.equals(selected.bytes))
        throw new GspotError('copy', INSTALLED_VALE_MESSAGE);
}

/**
Links the installed Vale packages into the copy when the copy keeps the Vale configuration they came from.

@param root the repository with the installed packages.
@param copyRoot where to link the packages.
@param paths the files of the copy.
*/
export function copyValePackages(root: string, copyRoot: string, paths: string[]): void {
    const valeConfigFiles = paths.filter(
        (path) => path === GSPOT_PATHS.valeConfigFile || path.endsWith(`/${GSPOT_PATHS.valeConfigFile}`),
    );
    using installed = openFiles(root);
    using destination = openFiles(resolve(copyRoot));
    const source = join(root, GSPOT_PATHS.valePackages);
    if (statSync(source, { throwIfNoEntry: false })?.isDirectory() !== true) return;
    for (const config of valeConfigFiles) assertValeMatches(installed, destination, config);
    const target = join(copyRoot, GSPOT_PATHS.valePackages);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
}
