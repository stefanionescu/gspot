import { join, resolve } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { preparePath } from '#cli/system/files/bounded.ts';
import { statSync, symlinkSync, realpathSync } from 'node:fs';
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
    const installed = openFiles(root);
    const destination = openFiles(resolve(copyRoot));
    const source = join(root, GSPOT_PATHS.valePackages);
    if (statSync(source, { throwIfNoEntry: false })?.isDirectory() !== true) return;
    for (const config of valeConfigFiles) assertValeMatches(installed, destination, config);
    const target = preparePath({ root: realpathSync(resolve(copyRoot)) }, GSPOT_PATHS.valePackages);
    symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
}
